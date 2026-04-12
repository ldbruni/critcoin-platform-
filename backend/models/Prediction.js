const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema({
  // The wallet address of the person making the prediction
  predictorWallet: {
    type: String,
    required: true,
    lowercase: true
  },
  // The wallet address of the person being predicted to win
  predictedWallet: {
    type: String,
    required: true,
    lowercase: true
  },
  // Which project this prediction is for (2, 3, or 4)
  projectNumber: {
    type: Number,
    required: true,
    default: 2
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

// Compound unique index: one prediction per user per project
predictionSchema.index({ predictorWallet: 1, projectNumber: 1 }, { unique: true });
predictionSchema.index({ predictedWallet: 1 });

module.exports = mongoose.model("Prediction", predictionSchema);
