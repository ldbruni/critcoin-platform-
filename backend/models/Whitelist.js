const mongoose = require("mongoose");

const whitelistSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true, lowercase: true },
  addedBy: { type: String, required: true }, // Admin wallet that added this wallet
  addedAt: { type: Date, default: Date.now },
  notes: { type: String } // Optional notes about why this wallet was whitelisted
});

// Index for faster lookups
whitelistSchema.index({ wallet: 1 });

module.exports = mongoose.model("Whitelist", whitelistSchema);