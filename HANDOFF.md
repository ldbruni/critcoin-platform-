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

**The MongoDB `Transaction` ledger is authoritative for every balance shown in the app.** The chain is an experiential layer that students verify on Sepolia Etherscan, never a source the UI reads back from.

| | Database ledger | On-chain balance |
|---|---|---|
| Role | **Authoritative** | Experiential / verification |
| Source | `Transaction` documents in MongoDB | `Token.balanceOf(wallet)` on Sepolia |
| Shown on | Everywhere in the app | Nowhere in the app — Etherscan links only |
| Changed by | Tips, deploys, joining credits, admin corrections | Tips and deploys (real transfers) |

Admin → **Deploy CritCoin** now does **both**: it credits the ledger *and* transfers real tokens from the admin's MetaMask wallet, tracking each student's on-chain status individually.

The two can still disagree — admin corrections and joining credits are database-only by design. That gap is **expected**, is reported by `GET /api/admin/reconcile/:adminWallet`, and is never corrected automatically.

Full reasoning in [ARCHITECTURE.md](ARCHITECTURE.md) — "Balance authority". The working rule for anyone (human or agent) editing this code is in [CLAUDE.md](CLAUDE.md).

---

## 2. Authentication & authorization

There are no sessions, no JWTs, no passwords.

- **Identity** = the connected MetaMask wallet address. Any wallet may create one profile.
- **Admin** = wallet address matching `ADMIN_WALLET` (backend) / `REACT_APP_ADMIN_WALLET` (frontend).
- The frontend admin gate in [frontend/src/App.js](frontend/src/App.js) only hides the nav link — it is cosmetic. Real enforcement is server-side.
- Server-side, `authenticateAdmin` (POST body) and `authenticateAdminGET` (query string) verify a **signed message** against `ADMIN_WALLET`. Both live at the top of each route file that needs them ([backend/routes/admin.js](backend/routes/admin.js), [backend/routes/archive.js](backend/routes/archive.js)).
- **Development escape hatch:** when `NODE_ENV !== 'production'`, passing `adminWallet` without a `signature` is accepted with a console warning. Never run production with `NODE_ENV` unset.
- **Whitelist mode** (`SystemSettings.whitelistMode`, default `false`): when on, only wallets in the `Whitelist` collection can create a profile. Enforced in [backend/routes/profiles.js](backend/routes/profiles.js).

---

## 3. Data model

All in MongoDB via Mongoose. Wallet addresses are stored lowercase (mostly — see gotchas).

| Model | Key fields | Notes |
|---|---|---|
| `Profiles` | `wallet` (unique), `name`, `birthday`, `starSign`, `photo`, `archived` | One per wallet. Soft-deleted via `archived`. |
| `Project` | `authorWallet`, `projectNumber` (1–4), `title`, `description`, `image`, `totalReceived`, `archived` | Compound unique index on `(authorWallet, projectNumber)` — one submission per slot. |
| `Post` | `authorWallet`, `content`, `upvotes`, `downvotes`, `votes` (Map), `hidden` | Moderation is `hidden`, not deletion. |
| `Comment` | `postId`, `authorWallet`, `text`, `parentCommentId`, `upvotes[]`, `downvotes[]`, `archived` | `parentCommentId` gives one level of replies. Votes are arrays of wallets. |
| `Bounty` | `title`, `description`, `reward`, `status`, `completedBy`, `crossedOut` | **Survives semester clears.** |
| `Transaction` | `txHash` (**partial** unique — real hash or `null`), `hashFabricated`, `fromWallet`, `toWallet`, `amount`, `type`, `description`, `relatedId` | `type`: transfer / project_tip / forum_reward / system / mint / burn. See §11. |
| `Deploy` | `createdBy`, `amountPerStudent`, `status`, `rows[]` (`wallet`, `status`, `txHash`, `error`, `creditTxId`) | One document per deploy round; embedded per-student rows drive idempotent retries. |
| `Prediction` | `predictorWallet`, `predictedWallet`, `projectNumber`, `archived` | Compound unique on `(predictorWallet, projectNumber)` — one locked prediction per project. |
| `SystemSettings` | `key`, `value`, `updatedBy` | Key/value store. Live keys: `whitelistMode`, `predictionEnabled2/3/4`. |
| `Whitelist` | `wallet` (unique), `addedBy`, `notes` | Only consulted when `whitelistMode` is on. |
| `SemesterArchive` | `name` (unique), `stats`, plus denormalized `profiles/projects/posts/transactions/bounties/leaderboard/predictions` | Fully self-contained snapshot; wallet→name resolved at archive time. |

### Migration on boot

[backend/server.js](backend/server.js) runs one-time migrations on every startup, all idempotent:

1. Drops the legacy `predictorWallet_1` unique index and backfills `projectNumber: 2` on predictions missing it. Safe to remove once no deployment predates the multi-project predictions change (`e578c38`).
2. Replaces the legacy non-partial `txHash_1` unique index with a partial one, then calls `Transaction.syncIndexes()`. The `syncIndexes()` call is load-bearing — dropping alone races Mongoose's autoIndex pass and fails with `IndexOptionsConflict`. See §11.

Separately, [backend/migrations/flag-fabricated-hashes.js](backend/migrations/flag-fabricated-hashes.js) is a **manual** one-off (`node migrations/flag-fabricated-hashes.js`, with `--dry-run` support) that labels legacy fabricated hashes. Run it once per environment after deploying this change.

---

## 4. API surface

Base: `http://localhost:3001` in dev, `https://critcoin-platform-production.up.railway.app` in production. All routes are under `/api/*`.

**Health** — `GET /api/health` (declared ahead of the rate limiter so Railway's probe is never throttled)

**Profiles** — `/api/profiles`
`GET /` · `GET /:wallet` · `POST /` (create, multipart) · `POST /update` · `POST /archive` · `GET /photo/:filename`

**Projects** — `/api/projects`
`GET /leaderboard/top` · `GET /:projectNumber` · `GET /:projectNumber/:wallet` · `POST /` (submit, multipart) · `POST /send-coin` · `GET /image/:filename`

> Route order matters: `/leaderboard/top` is declared before `/:projectNumber` so it isn't swallowed by the param route (fixed in `fab5830`). Same pattern in predictions — `/settings` precedes `/check/:wallet`.

**Posts** — `/api/posts` — `GET /` · `POST /` · `POST /vote`

**Comments** — `/api/comments`
`GET /post/:postId` · `POST /` · `POST /:commentId/vote` · `POST /:commentId/unvote` · `DELETE /:commentId`

**Predictions** — `/api/predictions`
`GET /settings` · `GET /?project=N` · `GET /check/:wallet?project=N` · `POST /`

**Explorer** — `/api/explorer`
`GET /balance/:wallet` *(the authoritative balance — every balance in the UI comes from here)* · `GET /transactions` · `GET /transaction/:id` · `GET /stats` · `GET /wallet/:address` · `POST /sample-data`

**Archive** — `/api/archive`
Public reads: `GET /` · `GET /:archiveId` · `GET /:archiveId/profiles|projects|leaderboard|forum|explorer` · `GET /:archiveId/projects/:projectNumber`
Admin: `GET /admin/:adminWallet` · `GET /preview` · `POST /create` · `POST /clear-current` · `POST /delete` · `POST /update`

**Admin** — `/api/admin` (all admin-authenticated except the last)
`GET /dashboard/:adminWallet` · `GET|POST /profiles*` · `GET|POST /posts*` · `GET|POST /projects*` · `GET|POST /bounties*` · `GET|POST /settings*` · `GET|POST /whitelist*` · `GET /public/bounties` *(public)*

Deploy (see §12): `POST /deploy/start` · `POST /deploy/record` · `GET /deploy/latest/:adminWallet`
Diagnostics: `GET /reconcile/:adminWallet` — **read-only**, never writes and never sends a transaction

---

## 5. Tipping flow (end to end)

1. Student enters an amount on the Projects page and clicks send.
2. [frontend/src/pages/Projects.js](frontend/src/pages/Projects.js#L193-L232) builds an ethers v5 `Web3Provider`, gets a signer, and calls `contract.transfer(recipientWallet, amount)`.
3. MetaMask prompts; the transaction is mined on Sepolia.
4. The frontend POSTs `{ fromWallet, toWallet, amount, projectId, txHash }` to `/api/projects/send-coin`.
5. The backend increments `project.totalReceived`, validates the hash against `/^0x[0-9a-f]{64}$/i`, and writes a `Transaction` storing the **real** hash (or `null` if it was missing or malformed — never a fabricated one).
6. The frontend re-reads the **database** balance.

Resubmitting the same hash is a no-op: the backend returns the existing record rather than crediting `totalReceived` twice.

⚠️ The in-app balance check uses the ledger, but the transfer is real. A student in drift (ledger > chain) passes the check and then hits `Not enough tokens` from the contract. That is handled with an explicit message and is **not** auto-corrected — see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 6. Semester reset workflow

Admin → **Semester** tab. Order matters:

1. **Preview** (`GET /api/archive/preview`) — live counts of what will be captured.
2. **Create archive** (`POST /api/archive/create`) — requires a unique name. Snapshots active profiles, active projects, visible posts with their comment trees, all transactions, all bounties, active predictions, and a computed leaderboard. Wallet addresses are resolved to display names at snapshot time so archives stay readable after profiles are deleted.
3. **Clear current** (`POST /api/archive/clear-current`) — requires `confirmed: true`. Hard-deletes profiles (**except the admin wallet**), projects, posts, comments, transactions, and predictions.

**Bounties are deliberately not deleted** (`1e37937`) — they're reusable course content.

Nothing on-chain is touched. Student wallets keep whatever CritCoin they hold on Sepolia across the reset.

Archives are read-only and browsable by anyone at `/archive` and `/archive/:archiveId`.

---

## 7. Images

Uploads go to **Cloudinary** ([backend/routes/profiles.js](backend/routes/profiles.js) and [backend/routes/projects.js](backend/routes/projects.js)) via `upload_stream`, after Sharp resizing. Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

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
| Include new data in archives | `backend/models/SemesterArchive.js` (sub-schema), `backend/routes/archive.js` (`/create` and the read routes), `frontend/src/pages/Archive.js` |
| Allow a new frontend origin | `allowedOrigins` in `backend/server.js` |
| Show a balance anywhere | `fetchBalance()` from `frontend/src/utils/balance.js` — never `balanceOf` |
| Link an address or hash | `AddressLink` / `TxLink` from `frontend/src/components/ChainLink.js` |
| Read a balance server-side | `getBalance` / `getBalances` from `backend/lib/balances.js` |

---

## 11. Transaction hashes

`txHash` is a real Sepolia hash or `null`. **Never fabricate one.**

The unique index is **partial** (`partialFilterExpression: { txHash: { $type: 'string' } }`), so real hashes stay unique while any number of rows carry `null`. The old plain `unique: true` index permitted only one null document — which is precisely why the pre-refactor code invented hashes. If you ever see `E11000` on `txHash`, check that the boot migration in `server.js` ran.

- `txHash: null` → genuinely off-chain (deploy credit, joining credit, admin correction). Renders as "off-chain".
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
