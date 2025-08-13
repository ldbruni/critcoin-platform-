// backend/routes/posts.js
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");


// GET all non-archived profiles
router.get("/all", async (req, res) => {
  try {
    const profiles = await Profile.find({ archived: { $ne: true } });
    res.json(profiles);
  } catch (err) {
    console.error("Failed to fetch profiles:", err);
    res.status(500).send("Failed to fetch profiles");
  }
});

// Create a new post
router.post("/", async (req, res) => {
  const { authorWallet, content } = req.body;
  if (!authorWallet || !content) return res.status(400).send("Missing fields");

  try {
    const post = new Post({ authorWallet, content });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
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
    res.status(500).send("Failed to fetch posts");
  }
});

// Upvote or downvote a post
router.post("/vote", async (req, res) => {
  const { postId, type, voterWallet } = req.body;
  if (!postId || !["up", "down"].includes(type) || !voterWallet) {
    return res.status(400).send("Invalid vote request");
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).send("Post not found");

    const existingVote = post.votes.get(voterWallet);
    
    if (existingVote === type) {
      return res.status(400).send("You have already voted this way on this post");
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
    post.votes.set(voterWallet, type);
    if (type === "up") {
      post.upvotes += 1;
    } else {
      post.downvotes += 1;
    }

    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).send("Vote failed");
  }
});

module.exports = router;
