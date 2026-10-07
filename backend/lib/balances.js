// Database balances, derived from the Transaction ledger.
//
// The ledger is authoritative for every balance shown in the app. Balance is
// always computed from transactions rather than cached on a document: a cached
// figure would be a second ledger that could itself drift out of step, which is
// the exact problem this design exists to avoid.
//
// See ARCHITECTURE.md, "Balance authority".

const Transaction = require("../models/Transaction");

// Net balance for one wallet: everything received minus everything sent.
async function getBalance(wallet) {
  const address = String(wallet).toLowerCase();

  const [result] = await Transaction.aggregate([
    { $match: { $or: [{ toWallet: address }, { fromWallet: address }] } },
    {
      $group: {
        _id: null,
        received: {
          $sum: { $cond: [{ $eq: ["$toWallet", address] }, "$amount", 0] }
        },
        sent: {
          $sum: { $cond: [{ $eq: ["$fromWallet", address] }, "$amount", 0] }
        }
      }
    }
  ]);

  const received = result?.received || 0;
  const sent = result?.sent || 0;

  return { wallet: address, balance: received - sent, received, sent };
}

// Balances for many wallets in a single aggregation. Returns a Map keyed by
// lowercase address; wallets with no transactions are present with balance 0.
async function getBalances(wallets) {
  const addresses = wallets.map((w) => String(w).toLowerCase());

  const rows = await Transaction.aggregate([
    { $match: { $or: [{ toWallet: { $in: addresses } }, { fromWallet: { $in: addresses } }] } },
    {
      $facet: {
        received: [
          { $match: { toWallet: { $in: addresses } } },
          { $group: { _id: "$toWallet", total: { $sum: "$amount" } } }
        ],
        sent: [
          { $match: { fromWallet: { $in: addresses } } },
          { $group: { _id: "$fromWallet", total: { $sum: "$amount" } } }
        ]
      }
    }
  ]);

  const received = new Map((rows[0]?.received || []).map((r) => [r._id, r.total]));
  const sent = new Map((rows[0]?.sent || []).map((r) => [r._id, r.total]));

  return new Map(
    addresses.map((address) => {
      const inbound = received.get(address) || 0;
      const outbound = sent.get(address) || 0;
      return [address, { wallet: address, balance: inbound - outbound, received: inbound, sent: outbound }];
    })
  );
}

// How much CritCoin a student may invest in any rolling 24-hour window. The
// Projects page shows it; nothing enforces it.
const DAILY_INVESTMENT_LIMIT = 10000;

// What a wallet has invested in the last 24 hours. Investments are stored as
// project_tip, whether recorded by the Projects page or imported from the chain
// by lib/chainSync.js (which stamps the on-chain time), so both count.
// adminGrant and manualAdjustment are never project_tip and so never count.
async function getInvestedLast24h(wallet) {
  const address = String(wallet).toLowerCase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [result] = await Transaction.aggregate([
    { $match: { fromWallet: address, type: "project_tip", timestamp: { $gte: since } } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const invested = result?.total || 0;
  return {
    wallet: address,
    invested,
    limit: DAILY_INVESTMENT_LIMIT,
    remaining: Math.max(0, DAILY_INVESTMENT_LIMIT - invested)
  };
}

module.exports = { getBalance, getBalances, getInvestedLast24h, DAILY_INVESTMENT_LIMIT };
