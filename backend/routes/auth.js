// backend/routes/auth.js
//
// Sign-In With Ethereum (wallet-only sessions). One signature per session:
//
//   GET  /api/auth/nonce?wallet=0x...   -> { nonce, message }
//   POST /api/auth/verify {wallet, nonce, signature} -> { token, wallet, expiresAt, isAdmin }
//
// The token is an HMAC-signed bearer token (see lib/authToken.js). All
// state-changing routes derive identity from that token via middleware/auth.js —
// never from a wallet address in the request body. See SECURITY.md.

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { ethers } = require("ethers");
const Nonce = require("../models/Nonce");
const { issueToken } = require("../lib/authToken");

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes to sign after requesting

const isAddress = (w) => typeof w === "string" && /^0x[a-fA-F0-9]{40}$/.test(w);

function buildMessage(wallet, nonce, issuedAt, expiresAt) {
  // A readable challenge. The exact string is stored and re-used for recovery,
  // so formatting never has to match across client and server independently.
  return [
    "critcoin.art wants you to sign in with your Ethereum account:",
    wallet,
    "",
    "Sign in to CritCoin. This request will not trigger a blockchain transaction or cost gas.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`
  ].join("\n");
}

// GET a fresh sign-in challenge for a wallet.
router.get("/nonce", async (req, res) => {
  try {
    const wallet = String(req.query.wallet || "").toLowerCase();
    if (!isAddress(wallet)) {
      return res.status(400).json({ error: "Valid wallet query parameter required" });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
    const message = buildMessage(wallet, nonce, issuedAt.toISOString(), expiresAt.toISOString());

    await Nonce.create({ nonce, wallet, message, expiresAt });

    res.json({ nonce, message });
  } catch (err) {
    console.error("Auth nonce error:", err);
    res.status(500).json({ error: "Failed to issue nonce" });
  }
});

// POST the signature to exchange the nonce for a session token.
router.post("/verify", async (req, res) => {
  try {
    const wallet = String(req.body.wallet || "").toLowerCase();
    const { nonce, signature } = req.body;

    if (!isAddress(wallet) || !nonce || !signature) {
      return res.status(400).json({ error: "wallet, nonce and signature are required" });
    }

    // Atomically claim the nonce: it must exist, match this wallet, be unused and
    // unexpired. Marking it used in the same operation makes the signature
    // single-use (no replay).
    const record = await Nonce.findOneAndUpdate(
      { nonce, wallet, used: false, expiresAt: { $gt: new Date() } },
      { $set: { used: true } },
      { new: true }
    );

    if (!record) {
      return res.status(401).json({ error: "Invalid, expired, or already-used nonce" });
    }

    let recovered;
    try {
      recovered = ethers.utils.verifyMessage(record.message, signature);
    } catch (e) {
      return res.status(401).json({ error: "Bad signature" });
    }

    if (recovered.toLowerCase() !== wallet) {
      return res.status(401).json({ error: "Signature does not match wallet" });
    }

    const { token, expiresAt } = issueToken(wallet);
    const isAdmin = wallet === process.env.ADMIN_WALLET?.toLowerCase();

    res.json({ token, wallet, expiresAt, isAdmin });
  } catch (err) {
    console.error("Auth verify error:", err);
    res.status(500).json({ error: "Failed to verify signature" });
  }
});

module.exports = router;
