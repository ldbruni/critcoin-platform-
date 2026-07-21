const mongoose = require("mongoose");

// A real Sepolia transaction hash: 0x followed by exactly 64 hex characters.
// Used to tell genuine hashes from the fabricated ones written before the
// ledger-authority refactor (those came from Math.random().toString(16) and
// are roughly 19 characters long).
const REAL_TX_HASH = /^0x[0-9a-f]{64}$/i;

const transactionSchema = new mongoose.Schema({
  // Null for off-chain rows (deploy credits, joining credits, admin corrections).
  // Never fabricate a value here - a missing hash is a drift signal.
  txHash: { type: String, default: null },
  // Set by migrations/flag-fabricated-hashes.js on legacy rows whose hash was
  // invented and resolves to nothing on Etherscan.
  hashFabricated: { type: Boolean, default: false },
  fromWallet: { type: String, required: true },
  toWallet: { type: String, required: true },
  amount: { type: Number, required: true },
  type: {
    type: String,
    required: true,
    // 'adminGrant': CritCoin the admin/deployer wallet put in a student's hands as
    // an expression of admin intent - either a real on-chain transfer FROM the
    // deployer that syncAdminTransfers absorbed (real txHash), or the optional
    // 1-CritCoin welcome credit issued at profile creation (txHash: null). Only
    // deployer-sourced value is ever recorded this way; see lib/adminGrants.js.
    enum: ['transfer', 'project_tip', 'forum_reward', 'system', 'mint', 'burn', 'adminGrant']
  },
  description: { type: String }, // Description of the transaction
  relatedId: { type: String }, // ID of related post/project/etc
  blockNumber: { type: Number }, // For blockchain integration
  gasUsed: { type: Number }, // For blockchain integration
  status: {
    type: String,
    default: 'completed',
    enum: ['pending', 'completed', 'failed']
  },
  timestamp: { type: Date, default: Date.now }
});

// Index for efficient queries
transactionSchema.index({ fromWallet: 1, timestamp: -1 });
transactionSchema.index({ toWallet: 1, timestamp: -1 });
transactionSchema.index({ timestamp: -1 });

// Real hashes stay unique, but any number of rows may carry txHash: null.
// A plain `unique: true` would reject the second null row with E11000, which is
// why the pre-refactor code fabricated hashes instead of storing null.
transactionSchema.index(
  { txHash: 1 },
  { unique: true, partialFilterExpression: { txHash: { $type: 'string' } } }
);

module.exports = mongoose.model("Transaction", transactionSchema);
module.exports.REAL_TX_HASH = REAL_TX_HASH;
