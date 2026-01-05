// backend/models/SemesterArchive.js
const mongoose = require("mongoose");

// Schema for archived profile data
const archivedProfileSchema = new mongoose.Schema({
  wallet: String,
  name: String,
  birthday: String,
  starSign: String,
  photo: String,
  createdAt: Date
}, { _id: false });

// Schema for archived project data
const archivedProjectSchema = new mongoose.Schema({
  authorWallet: String,
  authorName: String,
  projectNumber: Number,
  title: String,
  description: String,
  image: String,
  totalReceived: Number,
  createdAt: Date
}, { _id: false });

// Schema for archived post data
const archivedPostSchema = new mongoose.Schema({
  authorWallet: String,
  authorName: String,
  content: String,
  upvotes: Number,
  downvotes: Number,
  createdAt: Date,
  comments: [{
    authorWallet: String,
    authorName: String,
    text: String,
    upvotes: Number,
    downvotes: Number,
    createdAt: Date,
    replies: [{
      authorWallet: String,
      authorName: String,
      text: String,
      upvotes: Number,
      downvotes: Number,
      createdAt: Date
    }]
  }]
}, { _id: false });

// Schema for archived transaction data
const archivedTransactionSchema = new mongoose.Schema({
  txHash: String,
  fromWallet: String,
  fromName: String,
  toWallet: String,
  toName: String,
  amount: Number,
  type: String,
  description: String,
  timestamp: Date
}, { _id: false });

// Schema for archived bounty data
const archivedBountySchema = new mongoose.Schema({
  title: String,
  description: String,
  reward: Number,
  status: String,
  completedBy: String,
  completedByName: String,
  createdAt: Date
}, { _id: false });

// Schema for leaderboard snapshot
const leaderboardEntrySchema = new mongoose.Schema({
  projectNumber: Number,
  entries: [{
    rank: Number,
    authorWallet: String,
    authorName: String,
    title: String,
    totalReceived: Number
  }]
}, { _id: false });

// Main semester archive schema
const semesterArchiveSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  archivedAt: {
    type: Date,
    default: Date.now
  },
  archivedBy: String, // admin wallet

  // Statistics snapshot
  stats: {
    totalProfiles: Number,
    totalProjects: Number,
    totalPosts: Number,
    totalComments: Number,
    totalTransactions: Number,
    totalBounties: Number,
    totalCritCoinTransferred: Number
  },

  // Archived data
  profiles: [archivedProfileSchema],
  projects: [archivedProjectSchema],
  posts: [archivedPostSchema],
  transactions: [archivedTransactionSchema],
  bounties: [archivedBountySchema],
  leaderboard: [leaderboardEntrySchema]
});

// Index for efficient queries
semesterArchiveSchema.index({ archivedAt: -1 });
semesterArchiveSchema.index({ name: 1 });

module.exports = mongoose.model("SemesterArchive", semesterArchiveSchema);
