// backend/routes/posts.js
const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
// Temporarily disable rate limiting
// const rateLimit = require('express-rate-limit');
const Post = require("../models/Post");
const Profile = require("../models/Profiles");


// Rate limiting for posts
// Rate limiting temporarily disabled - dummy middleware
const postLimiter = (req, res, next) => next();
const voteLimiter = (req, res, next) => next();

// Input validation middleware
const validatePost = [
  body('authorWallet').isEthereumAddress().withMessage('Invalid wallet address'),
  body('content')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content must be 1-2000 characters')
    .trim()
    .escape()
];

const validateVote = [
  body('postId').isMongoId().withMessage('Invalid post ID'),
  body('type').isIn(['up', 'down']).withMessage('Vote type must be "up" or "down"'),
  body('voterWallet').isEthereumAddress().withMessage('Invalid voter wallet address')
];

// Create a new post
router.post("/", validatePost, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { authorWallet, content } = req.body;

  try {
    // Verify user has a profile (business logic validation)
    const profile = await Profile.findOne({ 
      wallet: { $eq: authorWallet.toLowerCase() },
      archived: { $ne: true }
    });
    
    if (!profile) {
      return res.status(403).json({ error: "Must have an active profile to post" });
    }

    const post = new Post({ 
      authorWallet: authorWallet.toLowerCase(),
      content: content.trim()
    });
    
    await post.save();
    console.log(`✅ New post created by ${profile.name} (${authorWallet})`);
    res.status(201).json(post);
  } catch (err) {
    console.error('Post creation error:', err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Failed to create post' 
    });
  }
});

// Get all posts (newest first)
router.get("/", async (req, res) => {
  try {
    console.log("📋 Fetching posts...");
    // Only show non-hidden posts to regular users
    const posts = await Post.find({ hidden: { $ne: true } }).sort({ createdAt: -1 });
    console.log(`📋 Found ${posts.length} posts`);
    res.json(posts);
  } catch (err) {
    console.error("❌ Get posts error:", err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Failed to fetch posts' 
    });
  }
});

// Upvote or downvote a post
router.post("/vote", validateVote, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { postId, type, voterWallet } = req.body;

  try {
    // Verify voter has a profile
    const voterProfile = await Profile.findOne({ 
      wallet: { $eq: voterWallet.toLowerCase() },
      archived: { $ne: true }
    });
    
    if (!voterProfile) {
      return res.status(403).json({ error: "Must have an active profile to vote" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    if (post.hidden) {
      return res.status(403).json({ error: "Cannot vote on hidden post" });
    }

    const voterKey = voterWallet.toLowerCase();
    const existingVote = post.votes.get(voterKey);
    
    if (existingVote === type) {
      return res.status(400).json({ error: "You have already voted this way on this post" });
    }

    // Remove previous vote if exists
    if (existingVote) {
      if (existingVote === "up") {
        post.upvotes = Math.max(0, post.upvotes - 1);
      } else {
        post.downvotes = Math.max(0, post.downvotes - 1);
      }
    }

    // Add new vote
    post.votes.set(voterKey, type);
    if (type === "up") {
      post.upvotes += 1;
    } else {
      post.downvotes += 1;
    }

    await post.save();
    console.log(`✅ Vote recorded: ${voterProfile.name} ${type}voted post ${postId}`);
    res.json(post);
  } catch (err) {
    console.error('Vote error:', err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Vote failed' 
    });
  }
});

module.exports = router;
