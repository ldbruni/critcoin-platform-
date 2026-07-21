const mongoose = require("mongoose");

// A single-use sign-in challenge. The client asks for a nonce, signs the message
// we store here, and posts the signature back. On success the nonce is consumed
// (marked used) so the same signature can never be replayed.
//
// A TTL index purges expired/unused nonces automatically; we also check
// expiresAt explicitly on consume so a not-yet-purged nonce can't be used late.
const nonceSchema = new mongoose.Schema({
  nonce: { type: String, required: true, unique: true },
  wallet: { type: String, required: true }, // lowercased
  message: { type: String, required: true }, // the exact string the client signs
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
});

// Mongo purges the document once `expiresAt` passes.
nonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Nonce", nonceSchema);
