# CritCoin Platform — Deployment Guide

How the platform gets to **https://critcoin.art**. For architecture and known issues, see [HANDOFF.md](HANDOFF.md).

## Architecture

| Piece | Host | URL |
|---|---|---|
| Frontend (React SPA) | Vercel | https://critcoin.art |
| Backend (Express API) | Railway | https://critcoin-platform-production.up.railway.app |
| Database | MongoDB Atlas | — |
| Images | Cloudinary | — |
| Token contract | Sepolia testnet | `0x8e9A8155dD4f5F1b3f63461659b8C1B3232646d8` |

Both frontend and backend **auto-deploy on push to `main`**. Manual deploys are only needed to override that.

---

## 1. Backend (Railway)

Build is driven by [nixpacks.toml](nixpacks.toml); deploy settings by [railway.json](railway.json).

Set these in the Railway dashboard:

```
NODE_ENV=production
MONGO_URI=mongodb+srv://<your-atlas-connection-string>
ADMIN_WALLET=0xYourAdminWalletAddress
FRONTEND_URL=https://critcoin.art

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Session-token signing secret. REQUIRED — the server refuses to start without it
# in production. Long random string; rotating it just logs everyone out.
JWT_SECRET=your-long-random-secret

# Read-only Sepolia RPC. Powers deploy preflight, /api/admin/reconcile, admin-grant
# sync, and the admin on-chain readout.
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key

# Optional. The block the Token contract was deployed at. Narrows the Transfer-log
# scan used to absorb admin grants; without it the scan starts at block 0, which
# some RPC providers reject as too wide (the read then degrades to "nothing to
# absorb", and the grant stays visible as drift in reconcile).
TOKEN_DEPLOY_BLOCK=
```

`PORT` is injected by Railway — don't hardcode it.

> **Never set `SEPOLIA_PRIVATE_KEY` (or any deployer key) in Railway.** The backend
> does not sign transactions. Deploying CritCoin to students is signed in the
> admin's MetaMask, in the browser. `SEPOLIA_RPC_URL` is read-only — it serves
> `eth_call` and `eth_getBalance` for preflight and reconciliation, nothing more.
> Without it, deploy refuses to run rather than deploying blind, and the
> reconciliation report degrades to database-only figures.

**After first deploying this version**, run the one-off hash migration once
against production to label legacy fabricated hashes:

```bash
cd backend && node migrations/flag-fabricated-hashes.js --dry-run   # inspect
cd backend && node migrations/flag-fabricated-hashes.js             # apply
```

The boot migrations in `server.js` run automatically and are idempotent: the `txHash`
index rebuild **and** the whitelist seed (every existing profile's wallet is added to the
now-always-on whitelist, so no current student is locked out of re-creating a profile).

The server **exits on startup** if `MONGO_URI` or `ADMIN_WALLET` are missing, if `ADMIN_WALLET` isn't a valid `0x` + 40-hex address, or (in production) if `JWT_SECRET` is unset. Check the deploy logs first when a release fails to come up.

The health check is `GET /api/health`, matching `healthcheckPath` in `railway.json`. It is declared ahead of the rate limiter so the probe is never throttled.

---

## 2. Frontend (Vercel)

[vercel.json](vercel.json) runs `bash build-for-vercel.sh`, which builds inside `frontend/` and copies the output to the repo root (`outputDirectory: "build"`).

Environment variables — set in `vercel.json` and/or the Vercel dashboard:

```
REACT_APP_API_URL=https://critcoin-platform-production.up.railway.app
REACT_APP_ADMIN_WALLET=0xYourAdminWalletAddress
CI=false
GENERATE_SOURCEMAP=false
```

`REACT_APP_*` variables are **inlined at build time**. Changing the backend URL requires a rebuild, not just an env-var edit.

`CI=false` is required — React build warnings are otherwise treated as errors and fail the deploy.

### Manual deploy

```bash
npm install -g vercel
npm run deploy-frontend      # build-production + vercel --prod
```

---

## 3. DNS for critcoin.art

```
Type: CNAME    Name: www    Value: cname.vercel-dns.com
Type: A        Name: @      Value: 76.76.19.19
Type: A        Name: @      Value: 76.76.21.21
```

Then in Vercel: **Settings → Domains → Add `critcoin.art`**.

---

## 4. CORS

Allowed origins are hardcoded in [backend/server.js](backend/server.js). Production currently allows:

- `process.env.FRONTEND_URL`
- `https://critcoin.art`, `https://www.critcoin.art`
- `https://critcoin-platform.vercel.app`

**Adding a new frontend domain requires a code change and a backend redeploy.** Preview deployments on Vercel's generated URLs will be blocked by CORS.

---

## 5. Smart contract

The contract is already deployed to Sepolia and does not need redeploying for routine releases.

If you do redeploy:

```bash
# root .env needs ALCHEMY_API_KEY (full RPC URL) and SEPOLIA_PRIVATE_KEY
npx hardhat run scripts/deploy.js --network sepolia
```

Then:
1. Verify `frontend/src/contracts/{Token.json,contract-address.json,sepolia.json}` were rewritten by the script.
2. **Manually copy** the new address + ABI into `backend/sepolia.json` — the deploy script does not touch it.
3. Update the address in README.md and HANDOFF.md.
4. Redeploy the frontend so the new address is bundled.
5. Note that existing student balances live on the **old** contract and do not carry over.

---

## 6. Verifying a release

```bash
# Backend up and connected to Mongo
curl https://critcoin-platform-production.up.railway.app/health

# A public data endpoint
curl https://critcoin-platform-production.up.railway.app/api/profiles
```

Then in a browser at https://critcoin.art:
- [ ] Page loads over HTTPS with a valid certificate
- [ ] MetaMask connects and shows a Sepolia CritCoin balance
- [ ] Profiles, Projects, Leaderboard, Forum, Prediction, Archive all render
- [ ] Creating a profile with a photo works for a **whitelisted** wallet (exercises Cloudinary); a non-whitelisted wallet is refused with a clear message
- [ ] Admin panel is reachable from the admin wallet and hidden from others
- [ ] The admin on-chain readout shows in the nav for the admin wallet (and not for others)
- [ ] Admin → Reconcile loads; **Sync admin grants** absorbs a deployer-sourced on-chain transfer and leaves it reconciled

---

## 7. University network compatibility

The production setup is deliberately boring so campus firewalls don't interfere:

- HTTPS on port 443 only, with real certificates
- A normal public domain — no localhost, no custom ports
- Static assets served from Vercel's CDN
- Responsive layout for phones and lab machines

Students need nothing installed except MetaMask.

For **local development** on a restricted campus network, see [START_INSTRUCTIONS.md](START_INSTRUCTIONS.md).

---

## 8. Troubleshooting

**Frontend builds but the app can't reach the API**
Check `REACT_APP_API_URL` in the built bundle (browser Network tab). If it points at localhost, the env var wasn't set at build time.

**Requests blocked by CORS**
The origin isn't in `allowedOrigins` in `backend/server.js`. Common on Vercel preview URLs.

**Backend crash-loops on deploy**
Almost always a missing/invalid `MONGO_URI` or `ADMIN_WALLET`. The Railway logs print exactly which one.

**Images upload but don't display**
Verify the three `CLOUDINARY_*` variables are set on Railway. Legacy images served from `backend/uploads/` also have to match a strict filename pattern — see [HANDOFF.md](HANDOFF.md) §7.

**429 Too Many Requests**
Global rate limit is 100 requests / 15 minutes per IP in production. A whole classroom behind one campus NAT can trip it; raise the limit in `backend/server.js` if that becomes routine.
