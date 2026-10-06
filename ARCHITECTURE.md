# CritCoin — Architecture

Design decisions and the reasoning behind them. For the operational map of the
system — data model, full API surface, semester workflow, deployment mechanics —
see [HANDOFF.md](HANDOFF.md).

---

## Balance authority

**The chain is the record of transfers. The MongoDB `Transaction` ledger is an
index of them**, filled by importing real on-chain transfers (Sync from Chain,
[backend/lib/chainSync.js](backend/lib/chainSync.js)), plus a small number of
off-chain admin corrections. Every balance shown in the app is computed from
that ledger.

> This supersedes the earlier rule that the database is authoritative and drift
> is only ever reported. That rule broke in Fall 2026: the admin distributed
> CritCoin by hand from MetaMask and students invested from the homepage, so
> every real transfer was on Sepolia and none was in the database.

### The rules

1. **Balances come from the ledger.** Every balance rendered in the frontend is
   computed from `Transaction` documents, via
   `GET /api/explorer/balance/:wallet` (backed by
   [backend/lib/balances.js](backend/lib/balances.js)). No page calls
   `balanceOf`. The only exception is
   [frontend/src/components/Dapp.js](frontend/src/components/Dapp.js), the
   original Hardhat boilerplate demo at `/`, which is not a CritCoin app surface.

2. **Balance is derived, never cached.** It is always
   `sum(received) − sum(sent)` over the ledger. A stored balance field would be a
   second ledger that could itself fall out of step with the transactions.

3. **On-chain transfers are imported, from Etherscan.** Sync from Chain reads
   the contract's transfers from the Etherscan API (never the Sepolia RPC) and
   writes one `Transaction` per real txHash:
   - from the admin wallet → `adminGrant` (balance only; never an investment);
   - student → student → `project_tip`, credited to the recipient's submission
     for the **active critique project** (an admin setting);
   - anything else (no profile, sent to the admin, recipient has no submission)
     → skipped and listed. A profile is never invented.

   The admin previews and confirms the first sync; after that it runs every 5
   minutes on its own. The txHash unique index makes every run idempotent, and a
   tip already recorded by the project page's send flow counts as imported.

4. **Off-chain rows are the exception, and are labelled.** `manualAdjustment`
   (Admin → Sync from Chain → Manual adjustment) fixes mistakes that cannot be
   fixed on-chain; it affects balance only. Normal distributions are real sends
   from the admin wallet, picked up as `adminGrant`.

5. **Mismatches are reported, not forced.** After every sync the ledger balance
   of each student is compared with their on-chain balance (the sum of their
   transfer events — `Token.sol` moves balances only through `transfer()`).
   Expected causes: a skipped transfer, transfers from before the sync's start
   time (e.g. a wallet reused from an earlier semester), a manual adjustment.
   `GET /api/admin/reconcile/:adminWallet` remains a read-only RPC diagnostic.

### Why import instead of reading balances from the chain

A raw `balanceOf` cannot say *why* a student holds what they hold. The app needs
each transfer classified — grant or investment, and in which project — for
project totals, the leaderboard and the Explorer. Importing transfers gives both:
the chain stays the source of truth for what moved, and the ledger adds the
course meaning.

---

## Whitelist admission

**Roster membership is the only requirement to create a profile or to post.**
Holding CritCoin is a score, not a permission.

The app used to gate posting and project submission on holding ≥1 CritCoin, and
issued every new profile a 1-CritCoin "joining credit" purely so that gate could
be satisfied. That was circular — the credit existed only to clear the gate that
measured it — and it put an economic signal in charge of access control. Both the
gate and the credit are gone. A student with a balance of 0 is in good standing.

Admission is now a single question, asked in one place
([backend/lib/whitelist.js](backend/lib/whitelist.js)): is this address on the
roster? The `Whitelist` collection answers it, addresses are normalized to
lowercase on every read and write, and the check is **unconditional** — there is
no setting that turns it off. The instructor manages the roster from the admin
panel, behind the same `ADMIN_WALLET` signed-message check as every other admin
action.

The check runs on every post and submission, not only at signup, so removing a
wallet from the roster takes effect immediately.

### The limitation

**This gates on the address the client claims.** `main` has no sessions and no
signature on ordinary student requests: the browser sends `authorWallet` and the
server believes it. The whitelist reliably stops honest users from acting outside
the roster, but it is **not cryptographically enforced** — a forged address
bypasses it.

That is an accepted trade for now. Cryptographic enforcement arrives with the
SIWE sessions on the quarantined `security-hardening` branch, merged later; when
they land, these same checks bind to a verified session identity instead of a
claimed one. Nothing here depends on that branch.

---

## Feed authorship

**The Feed hides authorship in the API, not in the UI.** Posts are stored
like any other content — `FeedPost.authorWallet`, visible to the instructor in
the admin panel, the database, and the semester archive. What students get is
different: the public feed response carries no author field of any kind.

Hiding the name only in React would still ship it in the JSON, where anyone
can read it in the browser's network tab. So the guarantee lives on the server:

- **One serializer.** `toPublicPost` in
  [backend/lib/feed.js](backend/lib/feed.js) is the only shape in which a feed
  post leaves the server on a public route. It is an allow-list (`_id`, `text`,
  `images`, `createdAt`), so a field added to the model later does not leak by
  default. The feed query also projects `authorWallet` out, as a second guard.
- **Image URLs carry no identity.** Feed images get random Cloudinary public
  ids; the project uploader's `project_<wallet>_…` naming would put the author
  in every URL.
- **Own posts need a signature.** On `main` a request's wallet is whatever the
  client claims (see "Whitelist admission"). A "posts by wallet X" endpoint
  that believed the claim would let anyone map the whole feed by querying each
  roster wallet. So `POST /api/feed/mine` requires a `personal_sign` by that
  wallet — the same `verifyMessage` check the admin routes use — valid for 12
  hours so a student signs once per session. Posting itself still trusts the
  claimed wallet, like every other student write on `main`; a forged post is
  a roster problem, not a privacy leak.
- **The archive keeps authorship but serves it only to the admin.** See
  [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md).

This is display-hiding, not anonymity: the instructor and database always know
who posted what, and posting times are public, so a determined observer can
still correlate timing. There is no reveal flow because nothing was ever hidden
server-side.

The quota (posts today / this run) is computed server-side in the class time
zone (`feedTimeZone`, default `America/New_York`) and shown only to the signed
poster and the admin.

---

## Transaction hashes

`Transaction.txHash` holds a real Sepolia hash or `null`. It is **never**
fabricated.

Before this refactor both `/api/projects/send-coin` and the admin deploy wrote
`` `0x${Math.random().toString(16).substr(2,64)}` `` — a ~19-character string
that resolves to nothing on Etherscan. That was not merely sloppy: `txHash`
carried a plain `unique: true` index, which permits only a *single* document with
a null value, so fabricating a hash was the only way to insert more than one
off-chain row.

The index is now **partial** (see
[backend/models/Transaction.js](backend/models/Transaction.js)):

```js
{ unique: true, partialFilterExpression: { txHash: { $type: 'string' } } }
```

Real hashes stay unique; any number of rows may carry `null`. A one-time boot
migration in [backend/server.js](backend/server.js) drops the legacy index and
rebuilds it, and must call `syncIndexes()` to do so — dropping alone races
Mongoose's own autoIndex pass and fails with `IndexOptionsConflict`.

Legacy fabricated hashes are left in place but flagged `hashFabricated: true` by
[backend/migrations/flag-fabricated-hashes.js](backend/migrations/flag-fabricated-hashes.js),
which discriminates on length: real hashes match `/^0x[0-9a-f]{64}$/i`,
fabricated ones never do. The UI renders them as "legacy — no on-chain record"
rather than linking to a dead Etherscan page.

A `null` hash means the row is genuinely off-chain (admin
correction) and renders as "off-chain". Counts of both appear in
the reconciliation report as drift signals.

---

## Deploy: browser-side, imported like any other send

Admin → **Deploy CritCoin** is a batch of ordinary admin sends. It runs entirely
in the admin's browser through MetaMask — the same path as a manual send — and
writes nothing to the database itself. The Etherscan sync imports the transfers
as `adminGrant` rows, exactly as it would hand-sent ones.

**The backend holds no private key and is not on the deploy path.** It serves
the checklist (`GET /api/admin/deploy/roster/:adminWallet`: active profiles and
the `adminGrant`s already imported) and, after the run, triggers the sync
(`POST /api/admin/chain-sync/run`). Preflight — admin account, Sepolia network,
enough CritCoin for the total — reads MetaMask's provider, not a server RPC.

**Transfers are strictly sequential.** Concurrent sends from one wallet collide
on the nonce; each `tx.wait()` completes before the next begins. A rejection or
failure is marked and the loop continues to the next student.

**"Already granted" comes from the ledger.** Students holding an `adminGrant`
start unchecked, so a later deploy to one absent student re-sends to nobody else.
Because Etherscan can lag a transfer by a little, sends from the current page
session also stay unchecked until the import catches up.

> This replaced a server-coordinated deploy (`/deploy/start`, `/deploy/record`,
> a `Deploy` collection) that credited the ledger off-chain before sending and
> needed the backend's Sepolia RPC for preflight. The RPC was unreachable, and
> off-chain credits contradict "import, never invent", so it never ran.
