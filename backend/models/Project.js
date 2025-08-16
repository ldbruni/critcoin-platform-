const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  authorWallet: { type: String, required: true },
  projectNumber: { type: Number, required: true, min: 1, max: 4 }, // Projects 1-4
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String, required: true }, // filename of uploaded image
  totalReceived: { type: Number, default: 0 }, // total CritCoin received
  archived: { type: Boolean, default: false }, // admin can archive projects
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure one submission per wallet per project
projectSchema.index({ authorWallet: 1, projectNumber: 1 }, { unique: true });

module.exports = mongoose.model("Project", projectSchema);