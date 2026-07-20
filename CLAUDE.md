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

## Related rules that follow from it

- **Never fabricate a transaction hash.** Store the real one or `null`. A null is
  a meaningful signal that a row is off-chain; a fake hash is a lie that resolves
  to nothing on Etherscan. (The pre-refactor code did this — see
  `backend/migrations/flag-fabricated-hashes.js`.)
- **Never read `balanceOf` for display.** Balances come from
  `GET /api/explorer/balance/:wallet`. The sole exception is
  `frontend/src/components/Dapp.js`, the Hardhat boilerplate demo.
- **Never trust a client-supplied balance.** Compute it server-side from the
  ledger via `backend/lib/balances.js`.
- **Keep the deployer key out of the backend.** Signing happens in the admin's
  MetaMask. The server's chain access is read-only.

## Project layout

- `backend/` — Express API, Mongoose models, deployed on Railway
- `frontend/` — React SPA, deployed on Vercel
- `contracts/`, `scripts/`, `test/` — Hardhat; the Sepolia `Token` contract
- [HANDOFF.md](HANDOFF.md) — data model, API surface, semester workflow, gotchas
- [ARCHITECTURE.md](ARCHITECTURE.md) — design decisions and their reasoning
