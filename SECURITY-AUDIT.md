# CritCoin — Security Audit (Phase 1)

**Date:** 2026-07-20
**Scope:** `backend/` (Express API) and `frontend/` (React SPA). Read-only audit — no
code was changed and no dependencies were installed.
**Threat model:** classroom mischief at internet scale (an essay is publishing the
site). In-scope risks: impersonating students, forging tips/comments/submissions/
predictions, defacing the forum, rigging the leaderboard and prediction market,
spam uploads, gaining admin. Out of scope: token theft, MEV, contract exploits —
CritCoin is Sepolia testnet with no real value, and `Token.sol` is a teaching
artifact.

**Reproductions run during this audit** (in a scratchpad, not against production):
- Admin sign/verify round-trip (POST vs GET verification, replay, action binding) —
  `node repro.js` against `backend/node_modules/ethers`.
- Full git-history secret sweep (gitleaks/trufflehog are not installed; a scripted
  `git rev-list --all` + regex sweep was used instead).

---

## TL;DR — the five things that matter

1. **Student identity is unauthenticated everywhere.** Every state-changing student
   route trusts a wallet address in the request body/params. There are no sessions
   and no signature checks on student actions. Anyone with `curl` can act as any
   student. (§1b)
2. **The ledger can be forged directly.** `POST /api/projects/send-coin` takes
   `fromWallet`, `toWallet`, and `amount` from the body with no auth and no amount
   validation. Because the **database ledger is authoritative for all balances**,
   this is a mint/steal primitive and also rigs the leaderboard and prediction
   market. (§1b-F1, §1e)
3. **The "error but works" admin symptom is a frontend artifact, not a server
   fail-open.** Server-side admin verification is fail-*closed* and correct. The
   error comes from the admin UI firing multiple `signer.signMessage()` prompts
   concurrently (MetaMask rejects the overlapping one), while the panel stays usable
   because the admin gate is a purely client-side address compare. (§1a)
4. **Admin signatures are replayable for 5 minutes and not bound to a route.** There
   is no server-issued nonce, and the `action` field is never enforced (confirmed:
   it always mismatches and only `console.warn`s). A captured admin signature works
   on any admin endpoint until it expires. (§1a)
5. **Git history is clean of real secrets.** The one committed stray env file held
   only build flags (`HTTPS=true`, `HOST=0.0.0.0`, `GENERATE_SOURCEMAP=false`). Real
   credentials (Mongo, Cloudinary, deployer key) live only in the untracked local
   `backend/.env` and in Railway/Vercel — never committed. Rotation is still prudent
   but this is not a live leak. (§1d)

---

## 1a. Admin auth trace — the "error but works" mystery

### The path, end to end

1. **Message construction (frontend).** `frontend/src/pages/Admin.js`
   `createSignedAdminRequest(action, additionalData)` builds:
   ```js
   const messageData = { timestamp: Date.now(), action, wallet: wallet.toLowerCase(), ...additionalData };
   const message = JSON.stringify(messageData);
   const signature = await signer.signMessage(message);
   ```
2. **Transmission.**
   - GET (`fetchWithSignature`): `?message=<uriencoded>&signature=<sig>`.
   - POST (`postWithSignature`): body `{ ...data, adminWallet: wallet, message, signature }`.
3. **Backend recovery/comparison.** Two near-duplicate middlewares live at the top of
   both `backend/routes/admin.js` and `backend/routes/archive.js`:
   - `authenticateAdmin` (POST): `JSON.parse(message)` for the timestamp check, then
     `ethers.utils.verifyMessage(message, signature)` on the **raw** string.
   - `authenticateAdminGET` (GET): `JSON.parse(decodeURIComponent(message))`, then
     `verifyMessage(JSON.stringify(messageData), signature)` on a **re-serialized**
     string.

### Answers to the required questions

**Which admin routes verify server-side vs rely on the frontend hiding UI?**
Every route under `/api/admin/*` and the admin routes in `/api/archive/*` verify the
signature server-side (`authenticateAdmin` / `authenticateAdminGET`). I checked all of
them — none rely solely on UI hiding. **Two exceptions live outside those files:**
- `POST /api/profiles/archive` (in `routes/profiles.js`) is an admin action gated
  **only** on a plaintext `adminWallet === ADMIN_WALLET` compare — **no signature.**
  The admin address is public (it's on-chain), so anyone can call this. See §1b-F10.
- The **client** admin gate (`frontend/src/App.js`, `Admin.js`) is purely
  `wallet === ADMIN_WALLET`. It only hides the nav link and renders the panel; it is
  cosmetic, exactly as HANDOFF says.

**Is verification wrapped in try/catch, and what happens on the catch path?
(Fail-open check.)** Yes — both middlewares wrap recovery in `try/catch`. **The catch
path returns `403` (fail-closed).** A malformed signature/JSON throws and is denied.
`verifyMessage` itself does not throw for a well-formed signature; it returns whatever
address signed it, and a non-matching address is a `403`. **There is no fail-open on
the catch path.**

**The one real fail-open is the dev bypass, not the catch path:** both middlewares
contain
```js
if (process.env.NODE_ENV !== 'production' && adminWallet && !signature) { return next(); }
```
`railway.json` sets `NODE_ENV=production`, so this is closed in the deployed backend
*if that variable is actually applied*. **Action item:** confirm `NODE_ENV=production`
is set in the Railway dashboard/service, not just in `railway.json`. If it is ever
unset, **every admin route accepts an unsigned request that merely names the public
admin address** — a total admin bypass.

**Are addresses normalized identically on both sides?** Yes. Everywhere the compare is
`recovered.toLowerCase() === process.env.ADMIN_WALLET.toLowerCase()`. Both sides are
lowercased; no checksum-vs-lowercase mismatch. This is done consistently in admin.js,
archive.js, and profiles.js. (Good.)

**Nonce / timestamp / replayability.** The message carries a **client-generated
`timestamp`** with a 5-minute expiry (`Date.now() - timestamp > 300000`). There is **no
server-issued nonce**, so **a captured signature is replayable for up to 5 minutes**.
Worse, the `action` field is **not enforced** — the POST middleware computes
`expectedAction` and only `console.warn`s on mismatch. My repro shows the computed
value never even matches the client's:
```
expectedAction(server) = admin_post_/profiles/archive
action(client)         = admin_post_profiles_archive   -> equal? false  (warn only)
```
So within the 5-minute window, **one captured admin signature can be replayed against
any admin route**, not just the one it was signed for.

**Exact cause of "error but works" (reproduced).** The server verification is correct
for both GET and POST — my repro confirms both recover the admin address, and the GET
re-serialization round-trips **identically** (`JSON.stringify(JSON.parse(message)) ===
message` is `true`), so GET is not silently broken. The visible error is a **frontend
signature-concurrency artifact**:

- `Admin.js`'s `useEffect(..., [isAdmin, activeTab])` calls `fetchDashboard()`
  **and** the tab's own fetch on every tab switch. Each fetch calls
  `signer.signMessage()`. Two `signMessage` calls fire in the same tick.
- MetaMask processes one signature prompt at a time and rejects the overlapping
  request ("already pending"). The rejected fetch hits its `catch` and pops
  `alert('... error ...')`.
- Meanwhile the other request signs, verifies server-side, and returns data — and the
  panel was already rendered from the client-side `isAdmin` compare. So you **see an
  error alert while the page works**. The same thing happens after a write, whose
  success handler calls `fetchX()` and `fetchDashboard()` back-to-back (two more
  concurrent signatures).

This is eliminated in Phase 2 by signing **once per session** (SIWE → short-lived
token) instead of re-signing every fetch, and by making the UI reflect the server's
actual decision. Net: the "mystery" is not an auth weakness by itself, but it hides
the fact that the admin gate is cosmetic on the client.

---

## 1b. Student identity — every state-changing route

**How does the server know a request comes from the wallet it claims? It doesn't.**
There are no sessions, no JWTs, and no per-request signature on any *student* route.
Identity is whatever address is in the body/params. Every route below is
**impersonation-capable**. CORS does not help — these are plain HTTP calls with no
`Origin` header (the CORS config explicitly allows no-origin requests), so `curl`
works directly.

| # | Route | Trusts | Impact | Severity |
|---|---|---|---|---|
| F1 | `POST /api/projects/send-coin` | `fromWallet`,`toWallet`,`amount` | **Forge ledger entries**: mint balance to self, debit any victim, inflate any project's `totalReceived` (rig leaderboard + prediction market). No amount validation. | **Critical** |
| F2 | `POST /api/projects/` (submit) | `wallet` | Create/**overwrite** another student's project submission (one slot per `(wallet, projectNumber)` — you can clobber their entry). | **Critical** |
| F3 | `POST /api/profiles/update` | `wallet` | Edit **any** student's profile — name, birthday, photo. Impersonation/defacement. | High |
| F4 | `POST /api/profiles/archive` | `adminWallet` (public value, no sig) | Archive/soft-delete **any** profile. Admin action with no signature. | High |
| F5 | `DELETE /api/comments/:id` | `wallet` | "Only author can delete" — but author is the *supplied* wallet, so **delete any comment**. Forum defacement. | High |
| F6 | `POST /api/comments/` | `authorWallet` | Post comments as any student. | High |
| F7 | `POST /api/posts/` | `authorWallet` | Post forum content as any student. | High |
| F8 | `POST /api/predictions/` | `predictorWallet` | Submit a prediction as a victim — **burns their one-time, unchangeable prediction slot** for that project. | High |
| F9 | `POST /api/posts/vote` | `voterWallet` | Cast/relocate votes as any wallet; combined with the public roster, stuff the ballot. | Medium |
| F10 | `POST /api/comments/:id/vote` · `/unvote` | `wallet` | Same vote manipulation on comments. | Medium |
| F11 | `POST /api/profiles/` (create) | `wallet` | Pre-create profiles for arbitrary addresses (griefing). Mitigated by whitelist mode. | Low |

**Proof-of-concept (do NOT run against production):**

```bash
# F1 — mint 1,000,000 CritCoin to yourself and debit a victim, no signature, no on-chain tx.
# projectId is any id from GET /api/projects/2 ; toWallet is you, fromWallet is the victim.
curl -X POST https://<api>/api/projects/send-coin \
  -H 'Content-Type: application/json' \
  -d '{"fromWallet":"0xVICTIM","toWallet":"0xME","amount":1000000,"projectId":"<realProjectId>"}'

# F1b — negative amount reverses the flow (steal): credits fromWallet, debits toWallet.
#   -> {"fromWallet":"0xME","toWallet":"0xVICTIM","amount":-1000000,"projectId":"<id>"}

# F5 — delete any comment by claiming its author's (public) wallet.
curl -X DELETE https://<api>/api/comments/<commentId> \
  -H 'Content-Type: application/json' -d '{"wallet":"0xCOMMENT_AUTHOR"}'

# F8 — burn a victim's single prediction slot for project 2.
curl -X POST https://<api>/api/predictions \
  -H 'Content-Type: application/json' \
  -d '{"predictorWallet":"0xVICTIM","predictedWallet":"0xANYONE","projectNumber":2}'
```

The fix (Phase 2) is SIWE sessions: identity is derived from a verified short-lived
token, never from a wallet field in the request.

---

## 1c. Inventory of prior / partial security work

The repo has had a real security pass. Status of each measure:

| Measure | Where | State |
|---|---|---|
| `helmet` (CSP, headers) | `server.js` mounted | **Working.** CSP allows `unsafe-inline`/`unsafe-eval` in `scriptSrc` (weak) but this is an API server; low impact. |
| `express-mongo-sanitize` | `server.js` mounted | **Working.** Strips `$`/`.` keys from body/query/params — this is what neutralizes most NoSQL-operator injection app-wide. (Express 4, so `req.query` is still mutable; would break on Express 5.) |
| CORS allowlist | `server.js` | **Working but not a security control here** — no cookies are used for auth, and no-origin requests are allowed, so it doesn't stop `curl`. See §1e. |
| Global rate limiter (100/15min prod) | `server.js` mounted | **Working**, but coarse and IP-keyed. |
| Per-route rate limiters | `posts.js`, `profiles.js`, `admin.js` | **Abandoned/stubbed.** `postLimiter`, `voteLimiter`, `uploadLimiter`, `adminRateLimit` are all `(req,res,next)=>next()` dummies; imports commented out. Zombie middleware — decide: implement or delete. |
| `express-validator` | `posts.js`, `predictions.js`, `profiles.js`, `admin.js` (param) | **Partial.** Solid on posts/predictions/profile-create; **absent** on `comments.js` and on `projects.js` `send-coin`/submit (the highest-impact routes). |
| Admin signature auth | `admin.js`, `archive.js` | **Working but weak** (replay window, no nonce, action unbound, dev bypass, duplicated code). See §1a. |
| Upload magic-number validation | `profiles.js` | **Working** (checks file signatures + MIME match). `projects.js` upload is weaker (MIME-prefix only). |
| Path-traversal filename guards | `profiles.js`, `projects.js` `/photo|/image` | **Working** (strict regex + resolved-path prefix check). |
| Partial unique `txHash` index / no fabricated hashes | `models/Transaction.js`, `server.js` migration | **Working** (ledger-authority task). |
| `POST /explorer/sample-data` | `explorer.js` | **Working guard** — `403` in production; only seeds when empty. Dev-only. |

Net: the hardening *libraries* are installed and mostly mounted; the gaps are the
**stubbed per-route limiters**, **missing validation on `send-coin`/comments**, and the
fact that **none of it authenticates student identity**.

---

## 1d. Secrets

**gitleaks/trufflehog:** not installed, and installing is out of scope for Phase 1. I
ran an equivalent scripted sweep over **all** history
(`git rev-list --all` × `git grep` for Mongo SRV creds, `cloudinary://`, Cloudinary
secrets, Alchemy keys, `SEPOLIA_PRIVATE_KEY`, PEM private keys).

**Result: history is clean of real credentials.**
- Every hit was a **placeholder** — `backend/.env.example` (`username:password@cluster…`),
  `README.md` / `DEPLOYMENT.md` (`CLOUDINARY_API_SECRET=your-secret`).
- The stray Windows-path env file **was** committed once (blob `aae3d0d`, added in
  `258e158` "Configure production deployment…", filename
  `C:\Users\logan\…\frontend\.env` with the illegal-colon glyph). Its **entire
  contents** are:
  ```
  HTTPS=true
  HOST=0.0.0.0
  GENERATE_SOURCEMAP=false
  ```
  No secret. It is **not** in the HEAD tree. Because frontend `REACT_APP_*` vars are
  baked into the public JS bundle anyway, nothing sensitive could have been there.
- Real backend secret **prefixes** (Cloudinary cloud `drw8…`, the deployer key
  `056d…`, the real Mongo host) appear in **zero** commits.

**Where each live secret actually lives:**

| Secret | Location | Committed? | Notes |
|---|---|---|---|
| `MONGO_URI` | untracked local `backend/.env` + Railway env | No | Real value never in git. |
| `CLOUDINARY_API_KEY` / `_SECRET` / `_CLOUD_NAME` | local `backend/.env` + Railway env | No | " |
| `ALCHEMY_API_KEY` (full RPC URL) | local `backend/.env` + Railway env | No | Read-only RPC use. |
| `SEPOLIA_PRIVATE_KEY` (deployer key) | **local `backend/.env` only** | No | **Not used by the server** and must never be (per ARCHITECTURE). It should not be on any server; keep it off Railway. It controls the wallet holding real Sepolia CritCoin/ETH. |
| `ADMIN_WALLET` | Railway env + hardcoded public fallback in `App.js`/`Admin.js` | Yes (public) | An address, not a secret. |
| Frontend `REACT_APP_*` | `frontend/.env.production` (tracked) | Yes (public by design) | Only `REACT_APP_API_URL`, `PUBLIC_URL`, build flags. |

**`.gitignore` coverage:** root `.gitignore` covers `.env`, `frontend/.env*`,
`backend/.env`, `build/`. `backend/.env` is correctly untracked. **Gap:** the pattern
that would have caught the stray `C:\…frontend.env` file was the accidental filename
itself, which no `.gitignore` line matches; the file is gone from HEAD but remains in
history (benign, per above). Consider adding a defensive `*.env` and `*[Uu]sers*` guard.

**Recommendation:** history is not leaking, so rotation is *precautionary, not
urgent*. Still worth doing before going public (checklist is a Phase-2 deliverable),
because the credentials have been on developer machines and in deploy dashboards for a
while. Priority order: Cloudinary secret, Mongo user password, then the deployer key
(rotate by moving funds to a fresh wallet if you want a clean slate).

---

## 1e. Endpoint hardening survey

- **CORS:** allowlist (not `*`) — good. **But** the `origin` callback allows requests
  with **no `Origin` header** (`return callback(null, true)`), and no route uses
  cookies for auth, so CORS provides **no protection against the §1b attacks** — every
  PoC is a no-origin `curl`. Also allows a trailing-slash duplicate origin and throws
  (→ 500) on a blocked origin rather than returning a clean 403. Treat CORS as
  browser-hygiene, not access control.
- **Rate limiting:** only the **global** 100/15min (prod) limiter is active; it's
  IP-keyed and easily rotated. All per-route limiters are **stubbed no-ops** (§1c).
  Auth and write routes therefore have no tighter limit — spam uploads, vote-stuffing,
  and ledger-forgery loops are only bounded by the global counter.
- **Helmet / headers:** present. CSP permits `unsafe-inline`/`unsafe-eval` scripts —
  weak, but this process serves JSON + `/uploads`, not the SPA, so impact is low.
- **Body size limit:** `express.json({ limit: '10mb' })` — present. Multipart uploads
  are capped by multer (5MB profiles / 10MB projects). Reasonable.
- **Mongoose query injection:** `express-mongo-sanitize` strips `$`/`.` keys globally,
  and several routes additionally use `{ $eq: ... }`. Raw `req.query`/`req.body` are
  passed into filters in `explorer.js` and elsewhere, but the sanitizer neutralizes
  operator injection. **No raw-operator injection path found.** (Low residual risk.)
- **Cloudinary uploads:** `profiles.js` validates magic numbers + MIME match + size —
  good. `projects.js` only checks `mimetype.startsWith('image/')` (spoofable header) —
  weaker. **Neither requires authentication** — anyone can drive uploads to your
  Cloudinary account (cost/abuse vector), and `projects.js` submit is one of the
  unauthenticated §1b routes.
- **Numeric validation (the tip/prediction question):** `POST /projects/send-coin`
  does **no** numeric validation.
  - **Negative** (`-1000000`): passes the `!amount` truthy check → credits/debits
    reversed → **theft primitive**.
  - **Zero:** rejected (falsy).
  - **`1e308` / huge finite:** passes → arbitrary mint; corrupts `totalReceived` and
    all downstream balances.
  - **Non-numeric (`"abc"`):** `Number("abc")=NaN`. `project.totalReceived += NaN`
    then `save()` — `Project.totalReceived` is a `Number`, so Mongoose throws a
    CastError → 500; but if any code path persists NaN it poisons that project's total
    permanently. Either way it's a denial/corruption vector.
  Prediction amounts don't exist (predictions are wallet picks), but `predictedWallet`
  is unvalidated beyond "is an address + has a profile". The deploy/`amountPerStudent`
  path **is** validated (`Number.isInteger && > 0`) — good, use it as the template.

---

## 1f. Ranked findings & recommended fix order

Severity = impact under the classroom-at-scale threat model. Effort = S/M/L.
"Breaks workflow?" = does the fix change current student/admin UX.

| Rank | ID | Finding | Sev | Effort | Breaks workflow? |
|---|---|---|---|---|---|
| 1 | F1 | `send-coin` forges the authoritative ledger (mint/steal + rig leaderboard/predictions); no auth, no amount validation | **Critical** | M | Tips keep working; adds identity + amount checks |
| 2 | F2 | Project submit overwrites any student's submission (no auth) | **Critical** | S–M | No, once identity is derived from session |
| 3 | A1 | No student auth at all — 11 routes trust body wallet (§1b) | **Critical** (systemic) | L | One extra signature per session (SIWE); logs everyone out once |
| 4 | F4 | `POST /profiles/archive` = admin action with no signature (public admin address) | High | S | No |
| 5 | A2 | Admin signature replayable 5 min + not bound to route (no nonce, action unenforced) | High | M | No (re-sign flow changes internally) |
| 6 | A3 | Admin dev-bypass fail-open if `NODE_ENV` unset on server | High (conditional) | S | No — verify Railway env; make bypass opt-in |
| 7 | F5–F8 | Forge/delete comments, posts, predictions as any student | High | (covered by A1) | Same as A1 |
| 8 | H1 | Per-route rate limiters are stubbed; only coarse global limit | Med | S–M | No |
| 9 | H2 | Cloudinary uploads unauthenticated; `projects.js` MIME check spoofable | Med | S | No (after A1, gate on session) |
| 10 | F9–F10 | Vote manipulation (posts/comments) | Med | (covered by A1) | Same as A1 |
| 11 | A4 | "Error but works" admin UX (concurrent `signMessage`) | Med | M | Improves UX; fixed by session model |
| 12 | H3 | CORS allows no-origin + throws 500 on block; not an access control | Low | S | No |
| 13 | H4 | Helmet CSP allows `unsafe-inline/eval` | Low | S | No |
| 14 | S1 | Precautionary secret rotation (history clean, but creds are aged) | Low–Med | M (ops) | No |
| 15 | H5 | Zombie stubbed middleware / duplicated auth across admin.js & archive.js | Low | S | No |

### Recommended fix order (maps to the Phase-2 plan)

1. **Kill the ledger-forgery + impersonation class first (F1, F2, A1, F4–F10).**
   Introduce SIWE sessions (`GET /nonce` → sign → `POST /verify` → short-lived JWT),
   derive identity from the token on every write, and add server-side numeric
   validation to `send-coin` (positive, integer, bounded, finite). This single change
   closes the most and worst findings. Fold `POST /profiles/archive` into the shared
   admin middleware.
2. **Fail-closed admin (A2, A3, A4, H5).** One shared `requireAdmin` middleware with a
   server-issued nonce + expiry, enforced action/route binding, any throw → 401, and
   the dev bypass removed or made an explicit opt-in flag. De-duplicate admin.js /
   archive.js. Fix the frontend to sign once per session so the error/success shown
   reflects the server's decision.
3. **Baseline hardening (H1, H2, H3, H4).** Real per-route rate limits (tight on auth +
   writes), gate uploads behind the session, tighten `projects.js` upload validation to
   match `profiles.js`, restrict CORS, drop the no-origin allowance for state-changing
   methods.
4. **Precautionary secret rotation (S1).** Checklist deliverable; you execute the
   rotations. History is clean, so this is hygiene before publication, not incident
   response.

---

## Verification-checklist status (from the task)

| Check | Phase-1 status |
|---|---|
| "error but works" cause named + reproduced | **Done** — frontend concurrent `signMessage` + cosmetic client gate; server verify is fail-closed (repro confirms). Elimination is Phase 2. |
| Every admin route 401s an unsigned request | Verified all `/api/admin/*` + archive admin routes require a signature **except** `POST /api/profiles/archive` (F4) and the conditional dev-bypass (A3). |
| A cross-student write is rejected | **Currently NOT rejected** on any student route (§1b). To fix in Phase 2. |
| Replayed expired admin signature rejected | Expiry works (5 min); **no nonce**, so in-window replay + cross-route replay succeed today (A2). |
| Negative/zero/1e308 tip rejected | Today: zero rejected; **negative & 1e308 accepted** (§1e). To fix in Phase 2. |
| gitleaks clean OR rotations confirmed | Manual full-history sweep **clean**; rotation is precautionary. |
| CORS rejects unlisted origin | Rejects unlisted browser origins but **allows no-origin `curl`** (H3). |
| Repo private + deploys fire | Phase 3. |

---

### ⛔ Checkpoint 1 — awaiting your approval of the fix list and order before any code changes.
