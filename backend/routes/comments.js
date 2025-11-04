// backend/routes/comments.js
const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Profile = require("../models/Profiles");

// GET all comments for a post
router.get("/post/:postId", async (req, res) => {
  const { postId } = req.params;

  try {
    const comments = await Comment.find({
      postId,
      archived: { $ne: true }
    }).sort({ createdAt: -1 });

    // Enrich with profile data
    const profiles = await Profile.find({ archived: { $ne: true } });
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    const enrichedComments = comments.map(comment => {
      const profile = profileMap[comment.authorWallet.toLowerCase()];
      const walletAddress = comment.authorWallet;
      const displayName = profile?.name ||
        (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Unknown");

      return {
        ...comment.toObject(),
        authorName: displayName,
        authorPhoto: profile?.photo,
        netVotes: comment.upvotes.length - comment.downvotes.length
      };
    });

    res.json(enrichedComments);
  } catch (err) {
    console.error("Failed to fetch comments:", err);
    res.status(500).send("Failed to fetch comments");
  }
});

// POST create a new comment
router.post("/", async (req, res) => {
  const { postId, authorWallet, text, parentCommentId } = req.body;

  if (!postId || !authorWallet || !text) {
    return res.status(400).send("postId, authorWallet, and text are required");
  }

  if (text.length > 1000) {
    return res.status(400).send("Comment text must be 1000 characters or less");
  }

  try {
    const comment = new Comment({
      postId,
      authorWallet: authorWallet.toLowerCase(),
      text,
      parentCommentId: parentCommentId || null,
      upvotes: [],
      downvotes: []
    });

    await comment.save();

    // Return enriched comment
    const profile = await Profile.findOne({
      wallet: authorWallet.toLowerCase(),
      archived: { $ne: true }
    });

    const displayName = profile?.name ||
      `${authorWallet.slice(0, 6)}...${authorWallet.slice(-4)}`;

    res.json({
      ...comment.toObject(),
      authorName: displayName,
      authorPhoto: profile?.photo,
      netVotes: 0
    });
  } catch (err) {
    console.error("Failed to create comment:", err);
    res.status(500).send("Failed to create comment");
  }
});

// POST upvote/downvote a comment
router.post("/:commentId/vote", async (req, res) => {
  const { commentId } = req.params;
  const { wallet, voteType } = req.body; // voteType: 'upvote' or 'downvote'

  if (!wallet || !voteType) {
    return res.status(400).send("wallet and voteType are required");
  }

  if (voteType !== "upvote" && voteType !== "downvote") {
    return res.status(400).send("voteType must be 'upvote' or 'downvote'");
  }

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).send("Comment not found");
    }

    const walletLower = wallet.toLowerCase();

    // Remove from both arrays first (in case switching vote)
    comment.upvotes = comment.upvotes.filter(w => w !== walletLower);
    comment.downvotes = comment.downvotes.filter(w => w !== walletLower);

    // Add to appropriate array
    if (voteType === "upvote") {
      comment.upvotes.push(walletLower);
    } else {
      comment.downvotes.push(walletLower);
    }

    await comment.save();

    res.json({
      upvotes: comment.upvotes.length,
      downvotes: comment.downvotes.length,
      netVotes: comment.upvotes.length - comment.downvotes.length
    });
  } catch (err) {
    console.error("Failed to vote on comment:", err);
    res.status(500).send("Failed to vote on comment");
  }
});

// POST remove vote from a comment
router.post("/:commentId/unvote", async (req, res) => {
  const { commentId } = req.params;
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).send("wallet is required");
  }

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).send("Comment not found");
    }

    const walletLower = wallet.toLowerCase();

    // Remove from both arrays
    comment.upvotes = comment.upvotes.filter(w => w !== walletLower);
    comment.downvotes = comment.downvotes.filter(w => w !== walletLower);

    await comment.save();

    res.json({
      upvotes: comment.upvotes.length,
      downvotes: comment.downvotes.length,
      netVotes: comment.upvotes.length - comment.downvotes.length
    });
  } catch (err) {
    console.error("Failed to remove vote:", err);
    res.status(500).send("Failed to remove vote");
  }
});

// DELETE a comment (mark as archived)
router.delete("/:commentId", async (req, res) => {
  const { commentId } = req.params;
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).send("wallet is required");
  }

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).send("Comment not found");
    }

    // Only author can delete
    if (comment.authorWallet.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(403).send("Only comment author can delete");
    }

    comment.archived = true;
    await comment.save();

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Failed to delete comment:", err);
    res.status(500).send("Failed to delete comment");
  }
});

module.exports = router;
