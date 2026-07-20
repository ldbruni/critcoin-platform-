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

module.exports = { getBalance, getBalances };
