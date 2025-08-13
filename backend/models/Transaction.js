const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  txHash: { type: String, unique: true }, // For real blockchain transactions
  fromWallet: { type: String, required: true },
  toWallet: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['transfer', 'project_tip', 'forum_reward', 'system', 'mint', 'burn']
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

module.exports = mongoose.model("Transaction", transactionSchema);