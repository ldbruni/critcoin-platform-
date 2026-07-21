# Security

CritCoin is a classroom app on the Sepolia **testnet** — no real funds exist. The
threat model is classroom mischief at internet scale (the platform is being written
about publicly): impersonating students, forging tips/posts/comments/predictions,
defacing the forum, rigging the leaderboard and prediction market, and gaining admin.
Out of scope: token theft, MEV, contract exploits — `Token.sol` is a teaching artifact.

A full audit is in [SECURITY-AUDIT.md](SECURITY-AUDIT.md). This file is the summary of
the current posture.

## Repository visibility

The repository is being made **private pending publication** (flip performed by the
maintainer once Railway and Vercel GitHub App access is confirmed to survive the
change). If a public snapshot is later needed for the essay, it will be produced as a
separate, deliberate, sanitized export — not by flipping this repo public.

## Authentication & authorization model

Wallet-only, session-based. One signature prompt per session.

- **Sign-In With Ethereum** (`backend/routes/auth.js`):
  `GET /api/auth/nonce` issues a single-use, TTL-expiring challenge →
  the wallet signs it →
  `POST /api/auth/verify` checks the signature and returns a short-lived (12h),
  HMAC-signed **bearer token** (`backend/lib/authToken.js`). The nonce is consumed
  atomically, so a captured signature cannot be replayed.
- **Transport:** `Authorization: Bearer <token>`. No cookies, so no CSRF surface;
  CORS is browser hygiene, not the access-control boundary.
- **Every state-changing route derives identity from the token**, never from a wallet
  address in the request body (`backend/middleware/auth.js` → `requireAuth`, which sets
  `req.wallet`). This closed the impersonation class where any HTTP client could act as
  any student — including forging the authoritative ledger via `send-coin`.
- **Admin** is `requireAdmin`: a valid session token whose wallet equals `ADMIN_WALLET`.
  It is **fail-closed** — any missing/expired/invalid token or non-admin wallet is
  rejected (401/403). The previous per-request signed-message scheme (5-minute replay
  window, route binding never enforced, `NODE_ENV`-dependent dev bypass) has been
  removed. The admin UI gate remains cosmetic; enforcement is entirely server-side.
- **Amounts** on `send-coin` are validated server-side: positive, finite, whole, and
  within the sender's ledger balance; no self-tips. A tip can only move coins the
  sender actually holds.
- **Profile creation is gated by the whitelist** (the class roster), checked against the
  SIWE-verified wallet — admin intent, never a chain balance. Roster addresses are
  validated and lowercased on add, so a checksummed and a lowercase form of the same
  wallet are never two entries. Roster management (`/api/admin/whitelist/*`) is behind
  `requireAdmin`.

## Admin grants and the ledger boundary

The database ledger is authoritative, and the chain may write to it in exactly **one**
place: `syncAdminTransfers` ([backend/lib/adminGrants.js](backend/lib/adminGrants.js))
absorbs on-chain transfers **from the deployer/admin wallet only** (an on-chain topic
filter, so a student→student transfer can never credit the database — it stays as drift
in the reconcile report). It is idempotent on `txHash` and **never sends a transaction**;
the deployer key stays out of the backend. Exposed via the admin-only, deliberate
`POST /api/admin/reconcile/sync-grants`; `GET /reconcile` remains strictly read-only.

The admin-only on-chain readout (`GET /api/admin/onchain/:adminWallet`, behind
`requireAdmin`) reports the deployer/admin wallet's live CritCoin + Sepolia ETH. It reads
public chain state, is never a student balance, and is never exposed on a public route.

## Baseline hardening

- Helmet, `express-mongo-sanitize` (neutralizes NoSQL operator injection app-wide),
  tiered per-IP rate limits (reads generous, writes tighter, sign-in tightest),
  10 MB JSON body cap, multer upload caps.
- Image uploads require a session and are validated by magic-number signature +
  MIME match (profiles and projects).
- CORS is an allowlist (Vercel domains + localhost dev).

## Secrets

The full-git-history secret sweep is **clean** — no real credentials were ever
committed (the one stray committed env file held only build flags). Real secrets live
only in Railway/Vercel env and the untracked local `backend/.env`.

- `JWT_SECRET` is **required in production** (the server refuses to start without it).
- Precautionary rotation runbook: [SECRETS-ROTATION.md](SECRETS-ROTATION.md).
- **Secrets rotated on:** _pending — record the date here once §1–4 of SECRETS-ROTATION.md are complete._

## Reporting

This is a course project. Report security concerns to the instructor
(repo owner) directly rather than opening a public issue.
