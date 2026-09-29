// backend/models/FeedPost.js
//
// A post on The Feed. Authorship is stored normally, like any other content -
// the instructor and the database know who posted what. What differs is the
// public API: GET /api/feed never sends the author. See routes/feed.js.
//
// Images are Cloudinary URLs, never bytes. Width and height are kept so the
// feed can reserve layout space before a lazy-loaded thumbnail arrives.
const mongoose = require("mongoose");

const feedImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  width: { type: Number },
  height: { type: Number }
}, { _id: false });

const feedPostSchema = new mongoose.Schema({
  authorWallet: { type: String, required: true, lowercase: true, trim: true },
  text: { type: String, default: "", maxlength: 2000 },
  images: { type: [feedImageSchema], default: [] },
  hidden: { type: Boolean, default: false }, // admin moderation
  hiddenAt: { type: Date }
}, { timestamps: true });

// Self-view and quota counts
feedPostSchema.index({ authorWallet: 1, createdAt: -1 });
// Feed ordering and cursor pagination
feedPostSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model("FeedPost", feedPostSchema);
