# CritCoin — Maintainer Handoff

Everything a new maintainer needs beyond [README.md](README.md): how the pieces fit, where the data lives, the full API surface, the semester workflow, and the sharp edges.

Last verified against the codebase: **2026-07-19** (commit `501d815`).

---

## 1. The big picture

Three deployed pieces, plus a contract on a public testnet:

```
  Browser (MetaMask)
        │
        ├──── HTTPS ────►  Vercel: React SPA          (critcoin.art)
        │                        │
        │                        └── fetch ──► Railway: Express API
        │                                            │
        │                                            ├──► MongoDB Atlas
        │                                            └──► Cloudinary (images)
        │
        └──── JSON-RPC ──►  Sepolia testnet: Token contract
                            0x8e9A8155dD4f5F1b3f63461659b8C1B3232646d8
```

The React app talks to the chain **directly** through MetaMask. The backend never signs or submits transactions and holds **no private key**. It does have a *read-only* RPC provider ([backend/lib/chain.js](backend/lib/chain.js)) used for deploy preflight and reconciliation — `eth_call` and `eth_getBalance` only, never a send.

### Which balance is authoritative — read this first

**The chain is the record of transfers; the `Transaction` ledger is an index of them.** Every balance in the app is computed from the ledger, which is filled by importing real on-chain transfers (Admin → **Sync from Chain**, §13) plus labelled off-chain `manualAdjustment` rows.

| | Database ledger | On-chain |
|---|---|---|
| Role | Index of transfers; what the app displays | Record of transfers |
| Source | `Transaction` documents in MongoDB | `Transfer` events on Sepolia, read via the Etherscan API |
| Shown on | Everywhere in the app | Etherscan links |
| Changed by | Chain sync, the project-page send flow, manual adjustments | Real `transfer()` calls (MetaMask) |

Mismatches between a student's ledger and on-chain balance are listed after every sync — never forced to agree.

Full reasoning in [ARCHITECTURE.md](ARCHITECTURE.md) — "Balance authority". The working rule for anyone (human or agent) editing this code is in [CLAUDE.md](CLAUDE.md).

---

## 2. Authentication & authorization

There are no sessions, no JWTs, no passwords.

- **Identity** = the connected MetaMask wallet address. Any wallet may create one profile.
- **Admin** = wallet address matching `ADMIN_WALLET` (backend) / `REACT_APP_ADMIN_WALLET` (frontend).
- The frontend admin gate in [frontend/src/App.js](frontend/src/App.js) only hides the nav link — it is cosmetic. Real enforcement is server-side.
- Server-side, `authenticateAdmin` (POST body) and `authenticateAdminGET` (query string) verify a **signed message** against `ADMIN_WALLET`. Both live at the top of each route file that needs them ([backend/routes/admin.js](backend/routes/admin.js), [backend/routes/archive.js](backend/routes/archive.js)).
- **Development escape hatch:** when `NODE_ENV !== 'production'`, passing `adminWallet` without a `signature` is accepted with a console warning. Never run production with `NODE_ENV` unset.
- **Whitelist (class roster)**: membership in the `Whitelist` collection is the **only** requirement to create a profile, post, comment or submit a project — there is no CritCoin balance gate and no toggle. All reads go through [backend/lib/whitelist.js](backend/lib/whitelist.js), which lowercases addresses on both write and read. It gates the *claimed* address; see [ARCHITECTURE.md](ARCHITECTURE.md), "Whitelist admission".

---

## 3. Data model

All in MongoDB via Mongoose. Wallet addresses are stored lowercase (mostly — see gotchas).

| Model | Key fields | Notes |
|---|---|---|
| `Profiles` | `wallet` (unique), `name`, `birthday`, `starSign`, `photo`, `archived` | One per wallet. Soft-deleted via `archived`. |
| `Project` | `authorWallet`, `projectNumber` (1–5), `title`, `description`, `image`, `totalReceived`, `archived` | Compound unique index on `(authorWallet, projectNumber)` — one submission per slot. |
| `Post` | `authorWallet`, `content`, `upvotes`, `downvotes`, `votes` (Map), `hidden` | Moderation is `hidden`, not deletion. |
| `Comment` | `postId`, `authorWallet`, `text`, `parentCommentId`, `upvotes[]`, `downvotes[]`, `archived` | `parentCommentId` gives one level of replies. Votes are arrays of wallets. |
| `Bounty` | `title`, `description`, `reward`, `status`, `completedBy`, `crossedOut` | **Survives semester clears.** |
| `Transaction` | `txHash` (**partial** unique — real hash or `null`), `hashFabricated`, `fromWallet`, `toWallet`, `amount`, `type`, `description`, `relatedId` | `type`: transfer / project_tip / forum_reward / system / mint / burn / adminGrant / manualAdjustment. See §11, §13. |
| `Deploy` | `createdBy`, `amountPerStudent`, `status`, `rows[]` (`wallet`, `status`, `txHash`, `error`, `creditTxId`) | One document per deploy round; embedded per-student rows drive idempotent retries. |
| `Prediction` | `predictorWallet`, `predictedWallet`, `projectNumber`, `archived` | Compound unique on `(predictorWallet, projectNumber)` — one locked prediction per project. |
| `SystemSettings` | `key`, `value`, `updatedBy` | Key/value store. Live keys: `predictionEnabled2/3/4/5`, `feedRunStart`, `feedRunDays`, `feedDailyTarget`, `feedTimeZone`. |
| `Whitelist` | `wallet` (unique, lowercase), `label`, `addedBy`, `notes` | The class roster. Consulted on every profile creation, post, comment, project submission and feed post. |
| `FeedPost` | `authorWallet` (lowercase), `text`, `images[]` (`url`, `width`, `height`), `hidden` | The Feed. Authorship stored normally; the **public API never sends it**. Images are Cloudinary URLs, never bytes. Indexed on `(authorWallet, createdAt)` and `(createdAt, _id)`. |
| `SemesterArchive` | `name` (unique), `stats`, plus denormalized `profiles/projects/posts/transactions/bounties/leaderboard/predictions/feedPosts` | Fully self-contained snapshot; wallet→name resolved at archive time. `feedPosts` keeps authorship but is excluded from public reads. |

### Migration on boot

[backend/server.js](backend/server.js) runs one-time migrations on every startup, all idempotent:

1. Drops the legacy `predictorWallet_1` unique index and backfills `projectNumber: 2` on predictions missing it. Safe to remove once no deployment predates the multi-project predictions change (`e578c38`).
2. Replaces the legacy non-partial `txHash_1` unique index with a partial one, then calls `Transaction.syncIndexes()`. The `syncIndexes()` call is load-bearing — dropping alone races Mongoose's autoIndex pass and fails with `IndexOptionsConflict`. See §11.

Separately, [backend/migrations/flag-fabricated-hashes.js](backend/migrations/flag-fabricated-hashes.js) is a **manual** one-off (`node migrations/flag-fabricated-hashes.js`, with `--dry-run` support) that labels legacy fabricated hashes. Run it once per environment after deploying this change.

---

## 4. API surface

Base: `http://localhost:3001` in dev, `https://critcoin.up.railway.app` in production. All routes are under `/api/*`.

**Health** — `GET /api/health` (declared ahead of the rate limiter so Railway's probe is never throttled)

**Profiles** — `/api/profiles`
`GET /` · `GET /:wallet` · `POST /` (create, multipart) · `POST /update` · `POST /archive` · `GET /photo/:filename`

**Projects** — `/api/projects`
`GET /leaderboard/top` · `GET /:projectNumber` · `GET /:projectNumber/:wallet` · `POST /` (submit, multipart) · `POST /send-coin` · `GET /image/:filename`

> Route order matters: `/leaderboard/top` is declared before `/:projectNumber` so it isn't swallowed by the param route (fixed in `fab5830`). Same pattern in predictions — `/settings` precedes `/check/:wallet`.

**Posts** — `/api/posts` — `GET /` · `POST /` · `POST /vote`

**Comments** — `/api/comments`
`GET /post/:postId` · `POST /` · `POST /:commentId/vote` · `POST /:commentId/unvote` · `DELETE /:commentId`

**Feed** — `/api/feed`
`GET /?before=<cursor>&limit=N` *(public; no author field of any kind)* · `POST /` (multipart, whitelist-gated) · `POST /mine` *(wallet-signed; the signer's own posts + quota)*

**Predictions** — `/api/predictions`
`GET /settings` · `GET /?project=N` · `GET /check/:wallet?project=N` · `POST /`

**Explorer** — `/api/explorer`
`GET /balance/:wallet` *(the authoritative balance — every balance in the UI comes from here)* · `GET /transactions` · `GET /transaction/:id` · `GET /stats` · `GET /wallet/:address` · `POST /sample-data`

**Archive** — `/api/archive`
Public reads: `GET /` · `GET /:archiveId` *(minus `feedPosts`)* · `GET /:archiveId/profiles|projects|leaderboard|forum|explorer|feed` · `GET /:archiveId/projects/:projectNumber`
Admin: `GET /admin/:adminWallet` · `GET /admin/:adminWallet/feed/:archiveId` *(feed with authorship)* · `GET /preview` · `POST /create` · `POST /clear-current` · `POST /delete` · `POST /update`

**Admin** — `/api/admin` (all admin-authenticated except the last)
`GET /dashboard/:adminWallet` · `GET|POST /profiles*` · `GET|POST /posts*` · `GET|POST /feed*` · `GET|POST /projects*` · `GET|POST /bounties*` · `GET|POST /settings*` · `GET|POST /whitelist*` · `GET /public/bounties` *(public)*

Deploy (see §12): `POST /deploy/start` · `POST /deploy/record` · `GET /deploy/latest/:adminWallet`
Diagnostics: `GET /reconcile/:adminWallet` — **read-only**, never writes and never sends a transaction
Chain sync (see §13): `GET /chain-sync/status/:adminWallet` · `GET /chain-sync/preview/:adminWallet?since=&project=` · `POST /chain-sync/commit` · `POST /ledger/adjust`

---

## 5. Tipping flow (end to end)

1. Student enters an amount on the Projects page and clicks send.
2. [frontend/src/pages/Projects.js](frontend/src/pages/Projects.js#L193-L232) builds an ethers v5 `Web3Provider`, gets a signer, and calls `contract.transfer(recipientWallet, amount)`.
3. MetaMask prompts; the transaction is mined on Sepolia.
4. The frontend POSTs `{ fromWallet, toWallet, amount, projectId, txHash }` to `/api/projects/send-coin`.
5. The backend increments `project.totalReceived`, validates the hash against `/^0x[0-9a-f]{64}$/i`, and writes a `Transaction` storing the **real** hash (or `null` if it was missing or malformed — never a fabricated one).
6. The frontend re-reads the **database** balance.

Resubmitting the same hash is a no-op: the backend returns the existing record rather than crediting `totalReceived` twice.

Sends made outside the project page (e.g. MetaMask from the homepage) are picked up by the chain sync (§13); a send made here is recognized by its hash and not imported twice.

⚠️ The in-app balance check uses the ledger, but the transfer is real. A student whose ledger exceeds their chain balance passes the check and then hits `Not enough tokens` from the contract, which shows an explicit message.

---

## 6. Semester reset workflow

Admin → **Semester** tab. Order matters:

1. **Preview** (`GET /api/archive/preview`) — live counts of what will be captured.
2. **Create archive** (`POST /api/archive/create`) — requires a unique name. Snapshots active profiles, active projects, visible posts with their comment trees, all transactions, all bounties, active predictions, visible feed posts (with authorship), and a computed leaderboard. Wallet addresses are resolved to display names at snapshot time so archives stay readable after profiles are deleted.
3. **Clear current** (`POST /api/archive/clear-current`) — requires `confirmed: true`. Hard-deletes profiles (**except the admin wallet**), projects, posts, comments, transactions, predictions, and feed posts, and clears the chain sync's saved start time so auto-sync pauses until the next semester's first manual sync (otherwise it would re-import the cleared semester's transfers).

**Bounties are deliberately not deleted** (`1e37937`) — they're reusable course content.

Nothing on-chain is touched. Student wallets keep whatever CritCoin they hold on Sepolia across the reset.

Archives are read-only and browsable by anyone at `/archive` and `/archive/:archiveId`.

---

## 7. Images

Uploads go to **Cloudinary** via `upload_stream`, after Sharp resizing. Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Projects and the Feed share one pipeline, [backend/lib/images.js](backend/lib/images.js); profile photos still have their own in [backend/routes/profiles.js](backend/routes/profiles.js).

- **Feed uploads** opt into `autoOrient` (applies EXIF orientation before Sharp re-encodes and drops it) and `allowHeic` (Sharp's bundled libvips cannot decode iPhone HEIC, so undecodable input goes to Cloudinary as-is and is stored as JPEG). Project uploads keep their original behavior — neither flag.
- **Delivery sizes are URL transformations**, not stored copies: [frontend/src/utils/cloudinary.js](frontend/src/utils/cloudinary.js) splices `c_limit,w_400,f_auto,q_auto` (thumbnail), `w_800` (2×), or `w_1600` (expanded) into the stored URL. Transformed delivery also strips EXIF/GPS from what browsers receive.
- **Feed public ids are random** (`feed_<24 hex>`). Project ids embed the wallet (`project_<wallet>_…`), which is fine for projects but would publish the author in a feed image URL.

Legacy images live in `backend/uploads/` and are served by `GET /api/profiles/photo/:filename` and `GET /api/projects/image/:filename`. Both apply strict filename validation to block path traversal — project images must match `project_0x<40 hex>_<13 digits>_<8-20 chars>.jpg` exactly, or the request is rejected. If an old image 404s, this pattern is the usual reason.

`backend/check-photos.js` and `backend/fix-old-photos.js` are one-off maintenance scripts for that migration.

---

## 8. Deployment mechanics

| Piece | Host | Trigger | Config |
|---|---|---|---|
| Frontend | Vercel | push to `main` | [vercel.json](vercel.json) → `bash build-for-vercel.sh`, output `build/` |
| Backend | Railway | push to `main` | [railway.json](railway.json), [nixpacks.toml](nixpacks.toml) |
| Database | MongoDB Atlas | — | `MONGO_URI` |

`build-for-vercel.sh` builds inside `frontend/` then copies the output to the repo root, because Vercel is configured with the repo root as the project directory. `REACT_APP_API_URL` is baked in at build time via `vercel.json` — changing the backend URL requires a rebuild, not just an env change.

CORS allowed origins are hardcoded in [backend/server.js](backend/server.js#L47-L65). A new frontend domain must be added there.

---

## 9. Known issues & gotchas

Ordered roughly by how much trouble they'll cause.

1. **`backend/sepolia.json` is not written by `scripts/deploy.js`.** Only the three files under `frontend/src/contracts/` are. Redeploying the contract without manually copying leaves the backend copy stale — and the backend **does** now read it, in [backend/lib/chain.js](backend/lib/chain.js). Copy it after any redeploy.

2. **`Token.sol` is not fully ERC-20.** No `approve`/`allowance`/`transferFrom`/`decimals`. Wallets and explorers that assume the full interface will misbehave. Amounts are whole integers.

3. **`transfer()` in Token.sol has no return value and emits `console.log`.** The `hardhat/console.sol` import ships in the deployed bytecode. Harmless on a testnet, wasteful on mainnet.

4. **`build/` is committed to the working tree but gitignored.** It's a stale leftover of the Vercel output-directory experiments (`9e23693`, `ecab348`). Ignore it locally.

5. **`Dapp.js` still reads `balanceOf`.** It is the original Hardhat boilerplate demo at `/`, kept deliberately as a standalone wallet playground. It is the one documented exception to the database-balance rule — do not treat it as a pattern to copy.

6. **Admin GET auth requires `:adminWallet` in the path.** `authenticateAdminGET` reads `req.params.adminWallet`, so any new admin GET route must include that segment or auth fails. POST routes take it from the body instead.

7. **The `Emoji` component is unused.** [frontend/src/components/Emoji.js](frontend/src/components/Emoji.js) exists and [EMOJI-REPLACEMENT-EXAMPLE.md](EMOJI-REPLACEMENT-EXAMPLE.md) documents the plan, but the only call site in `FormPage.js` is commented out and the required PNGs were never added.

8. **Rate limiting is global** (100 req / 15 min in production). Image-heavy pages can brush against it. Admin routes skip the limiter in development only. `/api/health` is declared before the limiter and is exempt.

9. **Ethers v5, not v6.** `new ethers.providers.Web3Provider(...)`, `token.deployed()`, `deployer.getBalance()`. Upgrading to v6 is a breaking change across `Projects.js`, `Admin.js`, `Dapp.js`, `backend/lib/chain.js`, and `scripts/deploy.js`.

---

## 10. Where to start for common tasks

| Task | Files |
|---|---|
| Add a page | `frontend/src/App.js` (route + nav), new file in `frontend/src/pages/` |
| Add an API resource | new file in `backend/routes/`, model in `backend/models/`, mount in `backend/server.js` |
| Add an admin control | `backend/routes/admin.js` (behind `authenticateAdmin`), tab in `frontend/src/pages/Admin.js` |
| Add a toggleable setting | write a `SystemSettings` key via `POST /api/admin/settings`, read it where enforced |
| Change token behavior | `contracts/Token.sol` → `npx hardhat test` → redeploy → copy ABI/address to `frontend/src/contracts/` and `backend/sepolia.json` |
| Change what the public feed returns | `toPublicPost` in `backend/lib/feed.js` — an allow-list; never spread a `FeedPost` into a public response. Re-run `node backend/scripts/verify-feed.js` |
| Include new data in archives | `backend/models/SemesterArchive.js` (sub-schema), `backend/routes/archive.js` (`/create` and the read routes), `frontend/src/pages/Archive.js` — register it in [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md) |
| Add a project number | Every site listed in [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md), "Adding a project number" — the set is hardcoded, and the archive's leaderboard loop and the archive viewer's tabs are the two that fail silently |
| Allow a new frontend origin | `allowedOrigins` in `backend/server.js` |
| Show a balance anywhere | `fetchBalance()` from `frontend/src/utils/balance.js` — never `balanceOf` |
| Link an address or hash | `AddressLink` / `TxLink` from `frontend/src/components/ChainLink.js` |
| Read a balance server-side | `getBalance` / `getBalances` from `backend/lib/balances.js` |

---

## 11. Transaction hashes

`txHash` is a real Sepolia hash or `null`. **Never fabricate one.**

The unique index is **partial** (`partialFilterExpression: { txHash: { $type: 'string' } }`), so real hashes stay unique while any number of rows carry `null`. The old plain `unique: true` index permitted only one null document — which is precisely why the pre-refactor code invented hashes. If you ever see `E11000` on `txHash`, check that the boot migration in `server.js` ran.

- `txHash: null` → genuinely off-chain (deploy credit, admin correction). Renders as "off-chain".
- `hashFabricated: true` → a legacy invented hash, flagged by `backend/migrations/flag-fabricated-hashes.js`. Renders as "legacy — no on-chain record".

Fabricated values are ~19 characters; real ones are exactly 66. That length difference is how the migration tells them apart.

---

## 12. Deploy CritCoin

Credits the ledger **and** transfers real tokens. The admin's MetaMask signs; the backend holds no key.

1. `POST /api/admin/deploy/start` — preflight (deployer's CRIT and Sepolia ETH, 1.5× gas margin) **before any write**; creates or resumes the round; credits Mongo. Refuses to run if the RPC is unreachable.
2. The browser transfers to each student **sequentially**, awaiting each confirmation (nonce safety), posting each outcome to `POST /api/admin/deploy/record`.
3. `GET /api/admin/deploy/latest/:adminWallet` drives the status table.

**Interrupted deploys are resumed, not restarted.** `/deploy/start` returns `409` if a round is still `in_progress` — restarting instead of resuming would credit everyone twice. Use the *Resume deploy* button. Confirmed students are skipped; failed ones retried.

Requires `SEPOLIA_RPC_URL` (or the existing `ALCHEMY_API_KEY`, which already holds a full RPC URL) on the server.

## 13. Sync from Chain

Admin → **Sync from Chain** imports on-chain CritCoin transfers as `Transaction` rows. Logic: [backend/lib/chainSync.js](backend/lib/chainSync.js). Reads the Etherscan API V2 (`tokentx`, `chainid=11155111`, our contract) — **no RPC**. Needs `ETHERSCAN_API_KEY` on the server.

| Transfer | Recorded as | Counts as an investment? |
|---|---|---|
| Admin wallet → profile | `adminGrant` | No — balance only. Excluded from project totals, leaderboard, Explorer volume/24h, archive `totalCritCoinTransferred` |
| Profile → profile | `project_tip` on the recipient's submission for the **active critique project**; increments `totalReceived` | Yes |
| No profile, sent to the admin, recipient has no submission for the active project, self-send | skipped, listed with reason | — |

1. Choose **Active critique** (Project N) and **Transfers since** (default: last 24h). **Preview** writes nothing.
2. **Confirm** imports, then reports ledger vs chain balance per student. Mismatches are listed, never forced. A student's chain balance is the sum of their transfer events.
3. Confirm also saves the active project and start time (`SystemSettings` keys `activeCritiqueProject`, `chainSyncSince`). From then on the server re-runs the sync every 5 minutes (started in `server.js`). Change the active project here when the next critique starts.

Every run is idempotent: rows are keyed by real txHash (partial unique index); a project total is incremented only after its row inserts.

**Manual adjustment** (same tab): wallet, ± whole amount, note → one `manualAdjustment` row to/from `system`, `txHash: null`. Balance only; never an investment. For mistakes that can't be fixed on-chain — normal distributions should be real sends from the admin wallet.
