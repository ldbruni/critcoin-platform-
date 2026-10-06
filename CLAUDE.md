# Working rules for this repository

## Balance authority

> **The chain is the record of transfers; the database is an index of them.**
> On-chain CritCoin transfers are imported as `Transaction` rows by Sync from
> Chain (`backend/lib/chainSync.js`, Etherscan API — never the Sepolia RPC).
> This supersedes the earlier "database is authoritative, drift is only
> reported" rule.

- **Import, never invent.** A row for an on-chain transfer carries its real
  txHash. Admin sends are `adminGrant` (never investments); student → student
  sends are `project_tip` on the recipient's active-critique submission;
  everything else is skipped and reported. Never create a profile or guess a
  project to make a transfer fit.
- **Off-chain rows are labelled exceptions.** The only one is the admin's
  `manualAdjustment`. Don't add new ways to write balance rows that bypass the
  import.
- **Mismatches are reported, not forced.** After a sync, ledger vs chain
  differences are listed for a human. Never write a balancing row or send a
  transaction just to make the numbers agree.

See [ARCHITECTURE.md](ARCHITECTURE.md), "Balance authority".

## Related rules

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

## Access control

**Being on the whitelist is the only requirement to create a profile or to
post.** There is no CritCoin balance gate on either, and no joining credit —
holding CritCoin is a score, not a permission. Every roster read goes through
`backend/lib/whitelist.js`, which normalizes addresses to lowercase on write and
read alike; never query the `Whitelist` collection directly.

- **The `main` whitelist gates on claimed address; real enforcement depends on
  SIWE from the security branch, merged later.**
- **The public Feed API never carries authorship.** Every public feed
  response goes through `toPublicPost` in `backend/lib/feed.js`; never spread a
  `FeedPost` into one, and never put a wallet in a feed image's public id. See
  ARCHITECTURE.md, "Feed authorship".
- **Never import from `security-hardening`.** That branch is quarantined —
  `requireAdmin`, `middleware/auth`, SIWE, its `SystemSettings`. Needing any of
  them means the wrong thing is being built. Admin routes use the existing
  `ADMIN_WALLET` signed-message check.

See [ARCHITECTURE.md](ARCHITECTURE.md), "Whitelist admission".

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
