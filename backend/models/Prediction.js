const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema({
  // The wallet address of the person making the prediction
  predictorWallet: {
    type: String,
    required: true,
    unique: true,  // Enforces ONE prediction per user at DB level
    lowercase: true
  },
  // The wallet address of the person being predicted to win
  predictedWallet: {
    type: String,
    required: true,
    lowercase: true
  },
  // Timestamp when prediction was made
  createdAt: {
    type: Date,
    default: Date.now
  },
  // For future archiving/semester system
  archived: {
    type: Boolean,
    default: false
  }
});

// Index for efficient queries
predictionSchema.index({ predictorWallet: 1 });
predictionSchema.index({ predictedWallet: 1 });

module.exports = mongoose.model("Prediction", predictionSchema);
