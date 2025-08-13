const mongoose = require("mongoose");

const bountySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  reward: { type: Number, required: true }, // CritCoin reward amount
  status: { 
    type: String, 
    default: 'active',
    enum: ['active', 'completed', 'cancelled', 'crossed_out']
  },
  completedBy: { type: String }, // wallet address of who completed it
  completedAt: { type: Date },
  crossedOut: { type: Boolean, default: false },
  crossedOutBy: { type: String }, // admin wallet who crossed it out
  crossedOutAt: { type: Date },
  createdBy: { type: String, required: true }, // admin wallet
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Bounty", bountySchema);