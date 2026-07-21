// backend/middleware/auth.js
//
// The single source of request identity. Every state-changing route derives the
// caller's wallet from the verified session token here, never from a wallet
// field in the request body/params.
//
//   requireAuth  -> 401 unless a valid Bearer token is present; sets req.wallet
//   requireAdmin -> requireAuth, then 403 unless req.wallet === ADMIN_WALLET
//
// Both are fail-closed: anything unexpected results in a rejection, never a pass.

const { verifyToken } = require("../lib/authToken");

function bearer(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim();
}

// Require a valid session. On success sets req.wallet (lowercased).
function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Sign in with your wallet." });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
  }
  req.wallet = payload.sub.toLowerCase();
  next();
}

// Require a valid session whose wallet is the admin wallet.
function requireAdmin(req, res, next) {
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  if (!ADMIN_WALLET) {
    console.error("ADMIN_WALLET environment variable not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Admin session expired or invalid" });
  }
  if (payload.sub.toLowerCase() !== ADMIN_WALLET) {
    console.warn("❌ Non-admin wallet attempted an admin action:", {
      wallet: payload.sub,
      ip: req.ip,
      path: req.originalUrl
    });
    return res.status(403).json({ error: "Admin privileges required" });
  }
  req.wallet = payload.sub.toLowerCase();
  req.adminWallet = req.wallet;
  next();
}

module.exports = { requireAuth, requireAdmin };
