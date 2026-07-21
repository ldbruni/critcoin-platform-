# CritCoin — Architecture

Design decisions and the reasoning behind them. For the operational map of the
system — data model, full API surface, semester workflow, deployment mechanics —
see [HANDOFF.md](HANDOFF.md).

---

## Balance authority

**The MongoDB `Transaction` ledger is authoritative for every balance shown in
the app.** The chain is an experiential and verification layer that students and
the instructor inspect on Sepolia Etherscan, not through our UI.

This is the single most important rule in the codebase. Everything below follows
from it.

### The rules

1. **The database is the ledger.** Every balance rendered anywhere in the
   frontend is computed from `Transaction` documents, via
   `GET /api/explorer/balance/:wallet` (backed by
   [backend/lib/balances.js](backend/lib/balances.js)). No page calls
   `balanceOf`. The only exception is
   [frontend/src/components/Dapp.js](frontend/src/components/Dapp.js), the
   original Hardhat boilerplate demo at `/`, which is not a CritCoin app surface.

2. **Balance is derived, never cached.** It is always
   `sum(received) − sum(sent)` over the ledger. A stored balance field would be a
   second ledger that could itself fall out of step with the transactions — the
   exact class of problem this design exists to eliminate.

3. **The chain is best-effort, and verified externally.** Real transfers do
   happen on Sepolia: students tip through MetaMask, and admin deploys transfer
   real tokens. Those are visible on Etherscan through the links rendered by
   [frontend/src/components/ChainLink.js](frontend/src/components/ChainLink.js).
   The app never reads a balance back from the chain to display it.

4. **The database wins on disagreement.** If the ledger says a student holds
   10,000 CritCoin and the chain says 0, the app shows 10,000. The student
   genuinely has 10,000 CritCoin as far as the course is concerned.

5. **Admin corrections are database-only, and produce expected drift.** An
   instructor adjusting a balance writes a `Transaction` and nothing else. The
   resulting gap between ledger and chain is a known, accepted state — not a bug.
   The same is true of the optional 1-CritCoin welcome grant at profile creation
   (the `grantOnCreate` toggle, default off), an off-chain `adminGrant` with no
   on-chain counterpart by design. See "Admin grants" below.

6. **Drift is surfaced, never auto-corrected.**
   `GET /api/admin/reconcile/:adminWallet` reports database balance, live chain
   balance, and the difference, for every student. It is strictly diagnostic:
   **it never writes to the database and never sends a transaction.** A human
   decides what, if anything, to do about drift.

### Why the ledger and not the chain

The chain cannot express what the course needs. `Token.sol` has no minting, so
an instructor cannot issue coins to a student who joins mid-semester without
manually transferring from the deployer wallet. Corrections, forum rewards, and
retroactive adjustments all need to be reversible bookkeeping, not irreversible
transfers. Meanwhile the chain gives students something the database cannot: a
real, public, independently verifiable record of their transactions.

Making the ledger authoritative and the chain experiential gets both. The cost is
drift, which is why drift is measured rather than prevented.

### Where the two can visibly disagree

Tipping is a real on-chain `transfer()` signed in MetaMask, but the balance a
student sees — and the pre-flight check in
[frontend/src/pages/Projects.js](frontend/src/pages/Projects.js) — comes from the
ledger. A student whose ledger balance exceeds their on-chain balance will pass
the in-app check and then have the contract revert with `Not enough tokens`.

That is handled with an explicit message telling them to contact the instructor.
It is deliberately **not** repaired by writing to the database or by sending a
compensating transaction. See the working rule in [CLAUDE.md](CLAUDE.md).

### Admin grants

Authority in CritCoin is not "database vs. chain" — it is **admin intent vs.
everything else.** The database is where admin intent is normally recorded, but a
token transfer *from the deployer/admin wallet* is another expression of that
intent, delivered on-chain instead of through the API. So when the instructor
sends a student CritCoin directly on Sepolia — to test a wallet or onboard someone
outside the tip/deploy routes — the ledger may legitimately record it.

`syncAdminTransfers(address)`
([backend/lib/adminGrants.js](backend/lib/adminGrants.js)) does exactly this: it
reads the Token's `Transfer` log for transfers **from the deployer to that
address** (the topic filter is the safety guarantee) and writes one `adminGrant`
`Transaction` per not-yet-recorded transfer, keyed on the real `txHash` for
idempotency. A transfer between any **other** two wallets is not admin intent and
is never absorbed — it stays visible as drift in the reconcile report for a human
to act on.

Two invariants hold this in place:

- **Only deployer-sourced transfers are absorbed.** The chain-level `from` filter
  means a student→student transfer can never be credited to the database.
- **The backend never signs.** `syncAdminTransfers` is read + database-write only;
  it never sends a transaction. The deployer key stays out of the backend, so the
  optional on-chain welcome grant is one the admin sends from their own wallet —
  the sync then absorbs it — not one the server initiates.

It runs in two places: best-effort after profile creation (so a welcome token sent
*before* onboarding is accounted for the moment the student joins), and behind the
explicit admin action `POST /api/admin/reconcile/sync-grants` (so grants sent
*after* a profile exists are caught on demand). The `GET /reconcile` view itself
stays strictly read-only; the sync is a separate, deliberate write.

Because an `adminGrant` is *received*, it never counts toward a sender's tip
budget, and it does count toward the student's authoritative database balance —
so a student who received a 1-CRIT grant and then goes through a full deploy ends
reconciled in both ledgers, with no double-count and no leftover drift.

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

A `null` hash means the row is genuinely off-chain (deploy credit, joining
credit, admin correction) and renders as "off-chain". Counts of both appear in
the reconciliation report as drift signals.

---

## Deploy: database and chain together

Admin → **Deploy CritCoin** credits the ledger *and* transfers real tokens.

**The backend holds no private key.** The admin's MetaMask wallet signs every
transfer in the browser. The backend has only a read-only RPC provider
([backend/lib/chain.js](backend/lib/chain.js)) used for preflight and
reconciliation. `SEPOLIA_RPC_URL` (falling back to the existing
`ALCHEMY_API_KEY`, which already holds a full RPC URL) is all it needs.

The split:

| Step | Where | What |
|---|---|---|
| `POST /api/admin/deploy/start` | server | Preflight, create/resume the round, credit Mongo |
| transfer loop | browser | `contract.transfer()` per student, **sequentially** |
| `POST /api/admin/deploy/record` | server | Store the real hash, or the failure |
| `GET /api/admin/deploy/latest/:adminWallet` | server | The per-student status table |

**Preflight aborts before any write.** It verifies the deployer holds enough
CritCoin for the roster and enough Sepolia ETH for the gas, with a 1.5× margin.
If the RPC is unreachable it refuses to run rather than deploying blind.

**Transfers are strictly sequential.** Concurrent sends from one wallet collide
on the nonce; each `tx.wait()` completes before the next begins. A failure is
recorded and the loop continues to the next student.

**Re-running is safe.** Each row moves `pending → credited → chain_confirmed`
(or `chain_failed`), and the ledger credit is written once, guarded by the row's
own status. Confirmed students are skipped and failed ones retried. Critically,
`/deploy/start` **refuses to open a new round while one is unfinished** — without
that, an admin re-clicking Deploy after a crash would credit everyone twice. The
only way forward from an interrupted deploy is to resume it.
