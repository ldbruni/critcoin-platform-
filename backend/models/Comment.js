// backend/models/Comment.js
const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true
  },
  authorWallet: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    default: null
  },
  upvotes: [{
    type: String, // wallet addresses
    lowercase: true
  }],
  downvotes: [{
    type: String, // wallet addresses
    lowercase: true
  }],
  archived: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
CommentSchema.index({ postId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1 });

module.exports = mongoose.model("Comment", CommentSchema);
