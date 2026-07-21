# Working rules for this repository

## Balance drift

> **Never "fix" balance drift by writing to the database to match the chain, or
> by initiating chain transactions to match the database. Drift is surfaced, not
> auto-corrected.**

The MongoDB `Transaction` ledger is authoritative for every balance shown in the
app; the chain is verified externally on Sepolia Etherscan. When they disagree,
the database wins and the gap is reported by
`GET /api/admin/reconcile/:adminWallet` for a human to act on.

This applies to any code that notices a mismatch — reconciliation, deploy, tips,
admin tooling. Report it, never silently repair it. See
[ARCHITECTURE.md](ARCHITECTURE.md), "Balance authority".

**The one thing the ledger may legitimately absorb is admin intent delivered
on-chain.** Authority in CritCoin is admin intent, not "database vs. chain": a
transfer *from the deployer/admin wallet* is admin intent, just sent on-chain
instead of through the API, so `syncAdminTransfers`
([backend/lib/adminGrants.js](backend/lib/adminGrants.js)) may record it. See
[ARCHITECTURE.md](ARCHITECTURE.md), "Admin grants".

## Related rules that follow from it

- **Never fabricate a transaction hash.** Store the real one or `null`. A null is
  a meaningful signal that a row is off-chain; a fake hash is a lie that resolves
  to nothing on Etherscan. (The pre-refactor code did this — see
  `backend/migrations/flag-fabricated-hashes.js`.)
- **Only transfers originating from the deployer/admin wallet may be absorbed
  into the ledger. Never credit the database from an arbitrary incoming chain
  transfer.** `syncAdminTransfers` filters on the on-chain `from` at the topic
  level — a student→student transfer is never recorded and stays visible as drift
  in reconcile. This absorption is the *only* place the chain writes to the
  ledger, and it never sends a transaction (read + database-write only).
- **Never read `balanceOf` for display.** Balances come from
  `GET /api/explorer/balance/:wallet`. Two exceptions, both deliberate:
  `frontend/src/components/Dapp.js` (the Hardhat boilerplate demo), and the
  admin-only on-chain readout (`frontend/src/components/AdminOnChainStatus.js` +
  `GET /api/admin/onchain/:adminWallet`), which shows the **deployer/admin**
  wallet's on-chain CRIT and gas as an operational gauge. Student-facing balances
  remain database-only.
- **Never trust a client-supplied balance.** Compute it server-side from the
  ledger via `backend/lib/balances.js`.
- **Keep the deployer key out of the backend.** Signing happens in the admin's
  MetaMask. The server's chain access is read-only — so an on-chain *welcome
  grant* is never auto-sent by the server; the admin sends it from their wallet
  and `syncAdminTransfers` absorbs it.
- **Profile creation is gated by whitelist membership, never by chain balance.**
  The whitelist is the always-on class roster (admin intent). Participation
  (posting, submitting) follows from having a whitelist-approved profile, not from
  holding CritCoin.

## Design system (v1 / v2 + Classic Mode)

The frontend has two themes, applied by wrapper class through
`frontend/src/theme/ThemeScope.js`. **v2** ("Dark Sleek Ledger") is the live
design on every route. **v1** is the original design, preserved as a git
artifact and reachable in-app via the **Classic Mode** toggle on past-semester
archive pages (`?view=classic`). How the layer works — the `:where()` scoping,
the token contract, the fidelity harness — is in
[frontend/src/styles/TOKENS.md](frontend/src/styles/TOKENS.md); the v2 spec is
in [DESIGN-V2.md](DESIGN-V2.md); the v1 record is in
[design-archive/v1/](design-archive/v1/).

Two rules protect the archival guarantee:

- **`frontend/src/styles/theme-v1.css` is frozen.** It reproduces the design at
  tag `design-v1` and is a historical record, not living code. Never
  "modernize" or refactor its values, never fix a value because it looks wrong
  — several are wrong on purpose (the light-body cascade accident, the
  undefined ghost variables). Changing it silently breaks Classic Mode fidelity.
  The ghost variables (`--accent-gold`, `--neon-cyan`, …) must stay **undefined**
  in every theme; see TOKENS.md.
- **The `design-v1-archive` branch is never touched.** It is the reference copy
  of the original design (tag `design-v1`, commit `1f08461`). Never rebase,
  update, or commit to it. Fidelity checks run the working tree's Classic Mode
  against this branch.

When editing Archive.js, remember it renders in **both** themes: tokenized
literals use `var(--token, original-literal)` fallbacks, and the fallback target
must be a token `theme-v1.css` does **not** define, or the v1/Classic scope
stops matching.

## Project layout

- `backend/` — Express API, Mongoose models, deployed on Railway
- `frontend/` — React SPA, deployed on Vercel
- `contracts/`, `scripts/`, `test/` — Hardhat; the Sepolia `Token` contract
- [HANDOFF.md](HANDOFF.md) — data model, API surface, semester workflow, gotchas
- [ARCHITECTURE.md](ARCHITECTURE.md) — design decisions and their reasoning
