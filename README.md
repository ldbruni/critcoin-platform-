# CritCoin — Educational Blockchain Platform

A full-stack classroom platform where students create profiles, submit projects, discuss in a forum, complete bounties, predict winners, and tip each other with **CritCoin** — a token deployed on the Ethereum Sepolia testnet.

Live at **https://critcoin.art**.

> New to the codebase or picking it up mid-semester? Read **[HANDOFF.md](HANDOFF.md)** — it covers architecture, the data model, the full API surface, the semester reset workflow, and known gotchas.

---

## Features

### Students
- **Profiles** — name, birthday, auto-derived star sign, photo (Cloudinary-hosted), MetaMask wallet identity
- **Projects** — one submission per student per project slot (Projects 1–4), with image upload
- **On-chain tipping** — send CritCoin to a project author via a real MetaMask transaction on Sepolia
- **Forum** — posts with upvote/downvote, threaded comments and replies with their own voting
- **Bounties** — instructor-created tasks with CritCoin rewards
- **Leaderboard** — top 3 projects per project slot, ranked by CritCoin received
- **Prediction Market** — one locked-in prediction per student per project (2, 3, 4) for who will win
- **Explorer** — transaction ledger, per-wallet history, and platform stats
- **Archive** — browse read-only snapshots of previous semesters

### Instructor / Admin
Admin panel at `/admin`, gated on the wallet matching `ADMIN_WALLET`. Tabs:

| Tab | What it does |
|---|---|
| Dashboard | Counts of profiles, posts, projects, bounties |
| Profiles | Archive / restore student profiles |
| Posts | Hide / unhide forum posts |
| Projects | Archive / restore project submissions |
| Bounties | Create, edit, cross out, delete bounties |
| Predictions | Open/close the prediction market per project (2, 3, 4) |
| Whitelist | Restrict profile creation to approved wallets |
| Semester | Preview, archive, and clear a semester's data |
| Deploy | Grant 10,000 CritCoin to every active student (ledger entry) |

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, React Router 6, Bootstrap 4, ethers.js **v5** |
| Backend | Node.js, Express 4, Mongoose 8 |
| Database | MongoDB (Atlas in production) |
| Images | Cloudinary (with local `uploads/` fallback for legacy files) |
| Security | helmet, express-rate-limit, express-mongo-sanitize, express-validator |
| Blockchain | Hardhat 2, Solidity 0.8.28, Sepolia testnet, MetaMask |
| Hosting | Vercel (frontend) + Railway (backend) + MongoDB Atlas |

---

## Local setup

### Prerequisites
- Node.js 18+
- MongoDB (local instance or an Atlas connection string)
- MetaMask browser extension
- A Cloudinary account (for image uploads)

### 1. Install

```bash
git clone <your-repo-url>
cd hardhat-boilerplate
npm install          # root: hardhat + concurrently
npm run setup        # installs frontend/ and backend/ deps
```

### 2. Environment variables

**`backend/.env`**
```env
MONGO_URI=mongodb://localhost:27017/critcoin
ADMIN_WALLET=0xYourAdminWalletAddress
PORT=3001
NODE_ENV=development

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

**`frontend/.env`**
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ADMIN_WALLET=0xYourAdminWalletAddress
```

**Root `.env`** (only needed to deploy/verify the contract)
```env
ALCHEMY_API_KEY=https://eth-sepolia.g.alchemy.com/v2/your-key
SEPOLIA_PRIVATE_KEY=your-testnet-private-key
```

> `ADMIN_WALLET` must be a valid `0x` + 40 hex-char address, or the backend refuses to start.
> `ALCHEMY_API_KEY` holds the **full RPC URL**, not just the key — that's what `hardhat.config.js` passes to `networks.sepolia.url`.

### 3. Run

```bash
npm run start-dev    # backend (:3001) + frontend (:3000), HTTPS enabled
```

Or separately:
```bash
npm run start-backend    # nodemon on :3001
npm run start-frontend   # react-scripts on :3000
```

On restrictive campus networks, see **[START_INSTRUCTIONS.md](START_INSTRUCTIONS.md)** for the alternate-port scripts (`start-university`, `start-secure`) and `network-test.html`.

---

## Smart contract

`contracts/Token.sol` is a **simplified, ERC-20-*style*** token — it implements `name`, `symbol`, `totalSupply`, `owner`, `balanceOf`, and `transfer` plus a `Transfer` event. It deliberately does **not** implement `approve`/`allowance`/`transferFrom`/`decimals`, so it is not a fully ERC-20-compliant contract and won't work with tooling that expects the full interface.

- Name/symbol: `CritCoin` / `CC`
- Total supply: 600,000,000, all minted to the deployer
- No decimals — amounts are whole integers

### Deploying

```bash
# Local
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

`scripts/deploy.js` writes `Token.json`, `contract-address.json`, and `sepolia.json` into `frontend/src/contracts/`. **`backend/sepolia.json` is not updated by the script** — copy it over manually if you redeploy.

Current deployed address: `0x8e9A8155dD4f5F1b3f63461659b8C1B3232646d8` (Sepolia)

### Tests

```bash
npx hardhat test
```

---

## Project structure

```
├── contracts/Token.sol           # CritCoin token
├── scripts/deploy.js             # deploys + writes ABI/address to frontend
├── tasks/faucet.js               # local hardhat faucet task
├── test/Token.js                 # contract tests
├── hardhat.config.js
│
├── backend/
│   ├── server.js                 # Express app, CORS, security, route mounting
│   ├── models/                   # Bounty, Comment, Post, Prediction, Profiles,
│   │                             # Project, SemesterArchive, SystemSettings,
│   │                             # Transaction, Whitelist
│   ├── routes/                   # admin, archive, comments, explorer, posts,
│   │                             # predictions, profiles, projects
│   ├── uploads/                  # legacy local image storage
│   └── sepolia.json              # contract address + ABI (manual copy)
│
├── frontend/
│   └── src/
│       ├── App.js                # routes + nav, admin gating
│       ├── pages/                # Admin, Archive, Bounties, Explorer, FormPage,
│       │                         # Leaderboard, Prediction, Profiles, Projects
│       ├── components/           # Dapp (home), wallet + tx UI components
│       ├── contracts/            # Token.json, contract-address.json, sepolia.json
│       └── styles/artistic.css
│
├── DEPLOYMENT.md                 # production deploy guide
├── HANDOFF.md                    # architecture + maintainer handoff
├── START_INSTRUCTIONS.md         # campus-network quick start
└── deployment-checklist.md
```

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full guide and **[deployment-checklist.md](deployment-checklist.md)** for the pre-flight list.

Short version: push to `main` → Railway auto-deploys the backend, Vercel auto-deploys the frontend.

---

## Semester reset

At the end of a term, from **Admin → Semester**:

1. **Preview** — check the counts about to be archived
2. **Create archive** — snapshots profiles, projects, posts + comments, transactions, bounties, predictions, and the leaderboard into a `SemesterArchive` document
3. **Clear current data** — deletes profiles (except admin), projects, posts, comments, transactions, and predictions

**Bounties are intentionally preserved** across semesters. Archives remain browsable at `/archive`.

---

## Troubleshooting

**MetaMask** — unlock the wallet, confirm you're on Sepolia, and clear activity data if you hit nonce errors.

**Database** — verify MongoDB is running and `MONGO_URI` is correct; the server exits on a failed connection.

**Images** — check the Cloudinary credentials. Older images served from `backend/uploads/` must match a strict filename pattern or the request is rejected.

**API / CORS** — the allowed-origin list lives in [backend/server.js](backend/server.js). Add any new frontend origin there. Health check is at `/api/health`.

---

## License

MIT — see [LICENSE](LICENSE).
