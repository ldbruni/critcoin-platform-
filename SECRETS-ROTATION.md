# CritCoin — Secrets Rotation Checklist

**Owner:** instructor / repo owner (you run the rotations; this is the runbook).
**Context:** The full-history secret sweep in [SECURITY-AUDIT.md](SECURITY-AUDIT.md)
(§1d) came back **clean** — no real credentials were ever committed. The one
committed stray `frontend/.env` held only build flags. So this rotation is
**precautionary hygiene before the repo/essay goes public**, not incident
response. Still worth doing: these credentials have lived on developer machines
and in deploy dashboards for a while, and one (`JWT_SECRET`) is brand new and must
be set for the new auth to work in production.

Do them in this order. Each credential: **create new → update the platform env →
redeploy → verify new works → verify old is dead.**

---

## 0. NEW — `JWT_SECRET` (required, do this first)

The session auth added in this work signs tokens with `JWT_SECRET`. Production
**will refuse to start** without it (`server.js` requires it when
`NODE_ENV=production`).

- [ ] Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- [ ] Set `JWT_SECRET` in **Railway** (backend service variables).
- [ ] Redeploy backend. Confirm it boots (logs: "All required environment variables are set").
- [ ] Verify: sign in from the site, perform one write (e.g. a forum post). It should succeed.
- [ ] Note: this is a secret, **frontend never sees it**. Do **not** add it to Vercel.
- [ ] Rotating it later is safe — it just logs everyone out (they re-sign once).

---

## 1. MongoDB Atlas — `MONGO_URI`

- [ ] Atlas → Database Access → create a **new** DB user (least privilege:
      `readWrite` on the app DB only), strong generated password.
- [ ] Build the new `mongodb+srv://…` connection string.
- [ ] Update `MONGO_URI` in **Railway**.
- [ ] Redeploy; confirm "Connected to MongoDB successfully" and the app reads/writes.
- [ ] Atlas → delete the **old** DB user. Confirm the old string now fails to authenticate.
- [ ] (Optional but recommended) Tighten the Atlas IP allowlist to Railway egress only.

## 2. Cloudinary — `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`

- [ ] Cloudinary console → Settings → Security / Access Keys → **generate a new API key/secret pair**.
- [ ] Update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in **Railway**
      (`CLOUDINARY_CLOUD_NAME` is not secret and can stay).
- [ ] Redeploy; verify a profile photo and a project image upload both succeed.
- [ ] Cloudinary → **disable/delete the old key pair**. Confirm uploads with the old
      secret fail (or simply that the old key no longer lists as active).

## 3. Alchemy / Sepolia RPC — `ALCHEMY_API_KEY` / `SEPOLIA_RPC_URL`

Read-only use (deploy preflight + reconcile), but the key is in the client of the
RPC provider and worth cycling.

- [ ] Alchemy dashboard → rotate the app's API key (or create a new app and swap the URL).
- [ ] Update `SEPOLIA_RPC_URL` (and/or `ALCHEMY_API_KEY`) in **Railway**.
- [ ] Redeploy; verify `GET /api/admin/reconcile/:adminWallet` still returns live
      `chainBalance` values (not null).
- [ ] Delete/deactivate the old Alchemy key.

## 4. Deployer wallet — `SEPOLIA_PRIVATE_KEY` (local only)

This key controls the wallet that holds the class's real Sepolia CritCoin + ETH.
It is **not** used by the server and must never be set on Railway. It lives only in
your local `backend/.env` (gitignored, never committed).

- [ ] Confirm `SEPOLIA_PRIVATE_KEY` is **not** set in Railway or Vercel.
- [ ] If you want a clean slate before publication: create a fresh deployer wallet,
      move the CritCoin + Sepolia ETH to it, and update your local `.env` +
      `hardhat.config.js` usage. (Optional — testnet only, no real value at risk.)
- [ ] Keep it out of any public snapshot of the repo.

## 5. Frontend env (Vercel) — sanity only

Frontend `REACT_APP_*` values are baked into the public JS bundle, so they are not
secrets. Nothing to rotate.

- [ ] Confirm Vercel has only non-secret vars: `REACT_APP_API_URL`,
      `REACT_APP_ADMIN_WALLET` (a public address), build flags. No DB/Cloudinary/JWT.

---

## After all rotations

- [ ] Trigger one deploy of each half from `main` and confirm both come up green.
- [ ] Smoke test end to end: sign in, post, tip, admin action.
- [ ] Record the rotation date in [SECURITY.md](SECURITY.md).
- [ ] Old credentials confirmed dead (checked above per item).
