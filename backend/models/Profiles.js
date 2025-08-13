// backend/models/Profile.js
const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  birthday: { type: String, required: true },
  starSign: { type: String, required: true },
  photo: { type: String }, // filename of profile photo
  archived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Profiles", profileSchema);
