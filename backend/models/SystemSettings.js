const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String } // Admin wallet that made the change
});

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);