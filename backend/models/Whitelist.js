const mongoose = require("mongoose");

// The class roster. Membership is the only requirement to create a profile or
// post; see backend/lib/whitelist.js, which owns all reads of this collection.
const whitelistSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true, lowercase: true },
  label: { type: String }, // Optional student name, for the admin roster view
  addedBy: { type: String, required: true }, // Admin wallet that added this wallet
  addedAt: { type: Date, default: Date.now },
  notes: { type: String } // Optional notes about why this wallet was whitelisted
});

// The unique constraint on `wallet` already provides the lookup index.

module.exports = mongoose.model("Whitelist", whitelistSchema);
