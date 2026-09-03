// Roster membership: the single admission control for CritCoin.
//
// A wallet may create a profile and post if, and only if, it appears here.
// There is no balance requirement for either - holding CritCoin is not a
// permission, it is a score. See ARCHITECTURE.md, "Whitelist admission".
//
// Addresses are stored and compared in one canonical form (lowercase), and
// every read and write goes through this module so the two can never drift
// apart. Mixed-case comparison has been a recurring bug source here.

const Whitelist = require("../models/Whitelist");

// The canonical stored form of an address.
function normalizeWallet(wallet) {
  return String(wallet || "").trim().toLowerCase();
}

// True when the wallet is on the roster.
async function isWhitelisted(wallet) {
  const address = normalizeWallet(wallet);
  if (!address) return false;

  const entry = await Whitelist.findOne({ wallet: address }).lean();
  return Boolean(entry);
}

// The single refusal message, so every gate reads identically to a student.
const NOT_WHITELISTED_MESSAGE =
  "This wallet isn't on the class roster - ask your instructor to add it.";

module.exports = { normalizeWallet, isWhitelisted, NOT_WHITELISTED_MESSAGE };
