// Compact HMAC-signed session tokens (a minimal JWT-HS256 equivalent).
//
// We deliberately avoid pulling in a JWT dependency: a short-lived, HMAC-SHA256
// signed token is a well-understood construction and this keeps the security
// surface small and auditable. Token shape:
//
//   base64url(JSON payload) . base64url(HMAC-SHA256(payload, JWT_SECRET))
//
// The payload is { sub: <wallet lowercased>, iat, exp } (seconds). Admin-ness is
// NOT stored in the token — requireAdmin derives it live by comparing `sub` to
// ADMIN_WALLET, so promoting/demoting an admin never requires reissuing tokens.
//
// See SECURITY.md for the session model.

const crypto = require("crypto");

// Sessions last 12 hours: long enough for a class session (one signature prompt
// per session), short enough that a leaked token expires the same day.
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production") {
    // Fail loudly rather than signing tokens with a guessable key in production.
    throw new Error("JWT_SECRET is not set (or too short) — refusing to issue session tokens");
  }
  // Development only: a stable-per-process fallback so local dev works without
  // configuration. Never reached in production because of the throw above.
  if (!global.__CRITCOIN_DEV_SECRET) {
    global.__CRITCOIN_DEV_SECRET = crypto.randomBytes(32).toString("hex");
    console.warn("⚠️ JWT_SECRET unset — using an ephemeral development secret. Set JWT_SECRET for production.");
  }
  return global.__CRITCOIN_DEV_SECRET;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payloadBytes) {
  return crypto.createHmac("sha256", getSecret()).update(payloadBytes).digest();
}

// Issue a token for a wallet. Returns { token, expiresAt (ms epoch) }.
function issueToken(wallet) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: String(wallet).toLowerCase(), iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadPart = b64url(JSON.stringify(payload));
  const sigPart = b64url(sign(payloadPart));
  return { token: `${payloadPart}.${sigPart}`, expiresAt: payload.exp * 1000 };
}

// Verify a token. Returns the payload ({ sub, iat, exp }) or null if the token is
// malformed, tampered with, or expired. Never throws.
function verifyToken(token) {
  try {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadPart, sigPart] = parts;

    const expected = sign(payloadPart);
    const provided = Buffer.from(sigPart, "base64url");
    // Constant-time comparison; timingSafeEqual throws if lengths differ.
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (!payload || typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { issueToken, verifyToken, SESSION_TTL_SECONDS };
