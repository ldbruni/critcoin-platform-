// Admin grants: absorbing deployer-sourced on-chain transfers into the ledger.
//
// The instructor sometimes sends a student CritCoin directly on-chain from the
// admin/deployer wallet - to test a wallet or onboard someone - outside the tip
// and deploy routes. That is admin intent, just delivered on-chain instead of
// through the API, so the ledger may legitimately record it.
//
// A transfer between any OTHER two wallets is not admin intent and must never be
// absorbed. It stays visible as drift in GET /api/admin/reconcile for a human to
// act on. See ARCHITECTURE.md "Admin grants" and the working rule in CLAUDE.md.
//
// This module is the write half; lib/chain.js getIncomingTransfersFrom is the
// read half. It NEVER initiates a chain transaction - it reads the log and writes
// the database only. The backend holds no key.

const chainLib = require("./chain");
const TransactionModel = require("./../models/Transaction");

// A ledger row for a deployer-sourced transfer we found on-chain. `source` is the
// real on-chain sender (always the deployer); the ledger `fromWallet` is 'system'
// so the deployer's derived DB balance is never driven negative - the same
// convention the deploy flow uses for its credits.
function grantDescription(source) {
  return `Admin grant from ${source}`;
}

// Absorb every not-yet-recorded on-chain transfer sent FROM the deployer wallet TO
// `address`. Idempotent: the transaction hash is the idempotency key, so running
// it twice records nothing the second time. Returns what it recorded so callers
// can log it or surface it in the UI.
//
// Dependencies (chain, Transaction, deployer) are injectable for testing; the
// defaults are the real modules and ADMIN_WALLET.
async function syncAdminTransfers(address, {
  deployer = process.env.ADMIN_WALLET,
  chain = chainLib,
  Transaction = TransactionModel
} = {}) {
  const to = String(address || "").toLowerCase();
  const from = String(deployer || "").toLowerCase();

  if (!to || !from) {
    console.warn("⚠️ syncAdminTransfers: missing address or deployer wallet - nothing to do");
    return { recorded: [], skipped: 0, deployer: from };
  }

  const transfers = await chain.getIncomingTransfersFrom(from, to);

  const recorded = [];
  let skipped = 0;

  for (const t of transfers) {
    // Defense in depth: the chain-level topic filter already guarantees this, but
    // never record a transfer whose source is not the deployer, and never a
    // non-positive amount.
    if (!t || t.from !== from || !(t.amount > 0) || !t.txHash) {
      continue;
    }

    // txHash is the idempotency key. Its partial-unique index also guards against
    // a concurrent second sync (the duplicate create throws E11000 below).
    const existing = await Transaction.findOne({ txHash: t.txHash });
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      const doc = await Transaction.create({
        fromWallet: "system",
        toWallet: to,
        amount: t.amount,
        type: "adminGrant",
        description: grantDescription(from),
        txHash: t.txHash,
        timestamp: t.timestamp || undefined
      });
      recorded.push({ txHash: t.txHash, amount: t.amount, to, id: doc._id });
    } catch (err) {
      // A racing sync already inserted this hash. Treat as already-recorded.
      if (err && err.code === 11000) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  if (recorded.length) {
    console.log(`✅ syncAdminTransfers: absorbed ${recorded.length} admin grant(s) to ${to} (${skipped} already recorded)`);
  }

  return { recorded, skipped, deployer: from };
}

module.exports = { syncAdminTransfers, grantDescription };
