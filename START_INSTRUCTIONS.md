# CritCoin Platform — Local Quick Start

For running the platform **locally** during development, especially on restricted university networks.

> Students don't need any of this — the live site at **https://critcoin.art** works from any browser with MetaMask. This document is for whoever is developing or demoing the platform.

## One-time setup

```bash
npm install     # root: hardhat + concurrently
npm run setup   # installs frontend/ and backend/ dependencies
```

You also need `backend/.env` and `frontend/.env` — see [README.md](README.md#2-environment-variables).

## Starting

```bash
npm run start-dev
```

Runs the backend on `:3001` and the frontend on `:3000` together, with HTTPS enabled and bound to `0.0.0.0`.
Open **https://localhost:3000**.

### If a firewall blocks the default ports

```bash
npm run start-university   # frontend :8080, backend :8081
npm run start-secure       # frontend :8443, backend :8444
```

Or double-click `university-setup.bat` (Windows) / run `./university-setup.sh` (Mac/Linux) — these try the port configurations in turn and report which one works.

To find out which configurations your network allows, open `network-test.html` in a browser.

### Running the two servers separately

```bash
# Terminal 1
cd backend && npm run dev      # nodemon, :3001

# Terminal 2
cd frontend && npm start       # :3000
```

On Windows, if the cross-env HTTPS flags misbehave:
```bash
cd frontend && npm run start-windows
```

## Local blockchain (optional)

The app points at the deployed **Sepolia** contract by default, so you don't need a local chain for normal development. To work against a local one:

```bash
npx hardhat node                                        # terminal 1
npx hardhat run scripts/deploy.js --network localhost   # terminal 2
```

Then add the Hardhat network to MetaMask — RPC `http://localhost:8545`, chain ID `31337` — and point `frontend/src/contracts/sepolia.json` at the local address.

## Troubleshooting

**Browser warns about the certificate** — expected. Local HTTPS uses a self-signed certificate; click through the warning.

**Backend exits immediately** — `MONGO_URI` or `ADMIN_WALLET` is missing or malformed in `backend/.env`. The console prints which.

**Frontend loads but no data** — confirm the backend is up (`curl http://localhost:3001/health`) and that `REACT_APP_API_URL` in `frontend/.env` matches its port. Restart the frontend after editing `.env` — React only reads it at startup.

**Can't reach it at all** — try `https://127.0.0.1:3000`, and allow Node.js through Windows Firewall.

## Production

Production is Railway (backend) + Vercel (frontend), auto-deploying from `main`. `npm start` from the repo root runs the backend only. See [DEPLOYMENT.md](DEPLOYMENT.md).
