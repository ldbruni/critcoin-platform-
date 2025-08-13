const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  authorWallet: { type: String, required: true },
  content: { type: String, required: true },
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  votes: {
    type: Map,
    of: String,
    default: {}
  },
  hidden: { type: Boolean, default: false },
  hiddenBy: { type: String }, // admin wallet who hid it
  hiddenAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Post", postSchema);
