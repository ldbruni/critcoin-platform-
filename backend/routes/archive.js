// backend/routes/archive.js
const express = require("express");
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const SemesterArchive = require("../models/SemesterArchive");
const Profile = require("../models/Profiles");
const Project = require("../models/Project");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Transaction = require("../models/Transaction");
const Bounty = require("../models/Bounty");
const Prediction = require("../models/Prediction");
const SystemSettings = require("../models/SystemSettings");
const { requireAdmin } = require("../middleware/auth");

// Admin routes here are gated by the shared requireAdmin (middleware/auth.js):
// session bearer token + ADMIN_WALLET check, fail-closed. See admin.js.

// ==================== PUBLIC ROUTES ====================

// GET all semester archives (public - for archive page)
router.get("/", async (req, res) => {
  try {
    const archives = await SemesterArchive.find()
      .select('name description archivedAt stats')
      .sort({ archivedAt: -1 });
    res.json(archives);
  } catch (err) {
    console.error("Archives fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archives' });
  }
});

// GET preview of what will be archived (public endpoint for admin UI).
//
// MUST stay above /:archiveId. Express matches in declaration order, so if the
// ObjectId param route is declared first it captures "/preview" and runs
// findById("preview"), which throws a CastError and 500s — the admin then sees
// 0 for every type (the frontend's `if (res.ok)` guard leaves the preview null).
// The counts below mirror the /create filters exactly. See ARCHIVE-MANIFEST.md.
router.get("/preview", async (req, res) => {
  try {
    const [profiles, projects, posts, comments, transactions, bounties, predictions] = await Promise.all([
      Profile.countDocuments({ archived: { $ne: true } }),
      Project.countDocuments({ archived: { $ne: true } }),
      Post.countDocuments({ hidden: { $ne: true } }),
      Comment.countDocuments({ archived: { $ne: true } }),
      Transaction.countDocuments(),
      Bounty.countDocuments(),
      Prediction.countDocuments({ archived: { $ne: true } })
    ]);

    res.json({ profiles, projects, posts, comments, transactions, bounties, predictions });
  } catch (err) {
    console.error("Archive preview error:", err);
    res.status(500).json({ error: 'Failed to get archive preview' });
  }
});

// GET single semester archive details (public)
router.get("/:archiveId", async (req, res) => {
  try {
    const archive = await SemesterArchive.findById(req.params.archiveId);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json(archive);
  } catch (err) {
    console.error("Archive fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archive' });
  }
});

// GET archived profiles for a semester
router.get("/:archiveId/profiles", async (req, res) => {
  try {
    const archive = await SemesterArchive.findById(req.params.archiveId)
      .select('name profiles');
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json({
      semesterName: archive.name,
      profiles: archive.profiles
    });
  } catch (err) {
    console.error("Archive profiles fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archived profiles' });
  }
});

// GET archived projects for a semester
router.get("/:archiveId/projects", async (req, res) => {
  try {
    const archive = await SemesterArchive.findById(req.params.archiveId)
      .select('name projects');
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json({
      semesterName: archive.name,
      projects: archive.projects
    });
  } catch (err) {
    console.error("Archive projects fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archived projects' });
  }
});

// GET archived projects by project number for a semester
router.get("/:archiveId/projects/:projectNumber", async (req, res) => {
  try {
    const projectNumber = parseInt(req.params.projectNumber);
    const archive = await SemesterArchive.findById(req.params.archiveId)
      .select('name projects');
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    const filteredProjects = archive.projects.filter(p => p.projectNumber === projectNumber);
    res.json({
      semesterName: archive.name,
      projectNumber,
      projects: filteredProjects
    });
  } catch (err) {
    console.error("Archive projects fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archived projects' });
  }
});

// GET archived leaderboard for a semester
router.get("/:archiveId/leaderboard", async (req, res) => {
  try {
    const archive = await SemesterArchive.findById(req.params.archiveId)
      .select('name leaderboard');
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json({
      semesterName: archive.name,
      leaderboard: archive.leaderboard
    });
  } catch (err) {
    console.error("Archive leaderboard fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archived leaderboard' });
  }
});

// GET archived forum posts for a semester
router.get("/:archiveId/forum", async (req, res) => {
  try {
    const archive = await SemesterArchive.findById(req.params.archiveId)
      .select('name posts');
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json({
      semesterName: archive.name,
      posts: archive.posts
    });
  } catch (err) {
    console.error("Archive forum fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archived forum' });
  }
});

// GET archived transactions for a semester
router.get("/:archiveId/explorer", async (req, res) => {
  try {
    const archive = await SemesterArchive.findById(req.params.archiveId)
      .select('name transactions');
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json({
      semesterName: archive.name,
      transactions: archive.transactions
    });
  } catch (err) {
    console.error("Archive explorer fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archived transactions' });
  }
});

// ==================== ADMIN ROUTES ====================

// GET all archives for admin management
router.get("/admin/:adminWallet", [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const archives = await SemesterArchive.find()
      .select('name description archivedAt archivedBy stats')
      .sort({ archivedAt: -1 });
    res.json(archives);
  } catch (err) {
    console.error("Admin archives fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch archives' });
  }
});

// POST create new semester archive (archives current site data)
router.post("/create", requireAdmin, async (req, res) => {
  // dryRun builds the full archive document in memory and validates it, but
  // never persists — an inspectable preview-without-commit. It exercises the
  // real capture/mapping code (not just counts), so what it reports is exactly
  // what a real run would write. See ARCHIVE-MANIFEST.md, "Dry run".
  const { name, description, dryRun } = req.body;

  if (!dryRun && (!name || !name.trim())) {
    return res.status(400).json({ error: 'Semester name is required' });
  }

  try {
    // Check if archive with this name already exists (skipped for dry runs,
    // which never write and may be run without a name).
    if (!dryRun) {
      const existingArchive = await SemesterArchive.findOne({ name: name.trim() });
      if (existingArchive) {
        return res.status(400).json({ error: 'An archive with this name already exists' });
      }
    }

    console.log(dryRun ? 'Dry-run archive inspection (no write)' : 'Starting semester archive creation:', name || '');

    // Fetch all current data (excluding already archived items)
    const profiles = await Profile.find({ archived: { $ne: true } });
    const projects = await Project.find({ archived: { $ne: true } });
    const posts = await Post.find({ hidden: { $ne: true } });
    const comments = await Comment.find({ archived: { $ne: true } });
    const transactions = await Transaction.find();
    const bounties = await Bounty.find();
    const predictions = await Prediction.find({ archived: { $ne: true } });

    // Snapshot the per-project prediction open/closed state. Predictions have no
    // resolution/payout record in this system — the winner is the leaderboard,
    // and the only "market" metadata is whether each project's round was open.
    // Defaults to open (true) when a setting doc is absent, matching predictions.js.
    const predictionSettingDocs = await SystemSettings.find({
      key: { $in: ['predictionEnabled2', 'predictionEnabled3', 'predictionEnabled4'] }
    });
    const predictionSettings = {
      predictionEnabled2: true,
      predictionEnabled3: true,
      predictionEnabled4: true
    };
    predictionSettingDocs.forEach(s => { predictionSettings[s.key] = s.value; });

    // Create profile lookup map
    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.wallet.toLowerCase()] = p.name;
    });

    // Build comments map by postId
    const commentsByPost = {};
    comments.forEach(c => {
      const postId = c.postId.toString();
      if (!commentsByPost[postId]) {
        commentsByPost[postId] = [];
      }
      commentsByPost[postId].push(c);
    });

    // Build nested comments structure
    const buildCommentTree = (postId) => {
      const postComments = commentsByPost[postId] || [];
      const topLevel = postComments.filter(c => !c.parentCommentId);

      return topLevel.map(comment => {
        const replies = postComments.filter(c =>
          c.parentCommentId && c.parentCommentId.toString() === comment._id.toString()
        );

        return {
          authorWallet: comment.authorWallet,
          authorName: profileMap[comment.authorWallet?.toLowerCase()] || 'Unknown',
          text: comment.text,
          upvotes: comment.upvotes?.length || 0,
          downvotes: comment.downvotes?.length || 0,
          createdAt: comment.createdAt,
          replies: replies.map(reply => ({
            authorWallet: reply.authorWallet,
            authorName: profileMap[reply.authorWallet?.toLowerCase()] || 'Unknown',
            text: reply.text,
            upvotes: reply.upvotes?.length || 0,
            downvotes: reply.downvotes?.length || 0,
            createdAt: reply.createdAt
          }))
        };
      });
    };

    // Archive profiles
    const archivedProfiles = profiles.map(p => ({
      wallet: p.wallet,
      name: p.name,
      birthday: p.birthday,
      starSign: p.starSign,
      photo: p.photo,
      createdAt: p.createdAt
    }));

    // Archive projects
    const archivedProjects = projects.map(p => ({
      authorWallet: p.authorWallet,
      authorName: profileMap[p.authorWallet?.toLowerCase()] || 'Unknown',
      projectNumber: p.projectNumber,
      title: p.title,
      description: p.description,
      image: p.image,
      totalReceived: p.totalReceived || 0,
      createdAt: p.createdAt
    }));

    // Archive posts with comments
    const archivedPosts = posts.map(p => ({
      authorWallet: p.authorWallet,
      authorName: profileMap[p.authorWallet?.toLowerCase()] || 'Unknown',
      content: p.content,
      upvotes: p.upvotes || 0,
      downvotes: p.downvotes || 0,
      createdAt: p.createdAt,
      comments: buildCommentTree(p._id.toString())
    }));

    // Archive transactions
    const archivedTransactions = transactions.map(t => ({
      txHash: t.txHash,
      fromWallet: t.fromWallet,
      fromName: t.fromWallet === 'system' ? 'System' : (profileMap[t.fromWallet?.toLowerCase()] || 'Unknown'),
      toWallet: t.toWallet,
      toName: profileMap[t.toWallet?.toLowerCase()] || 'Unknown',
      amount: t.amount,
      type: t.type,
      description: t.description,
      timestamp: t.timestamp
    }));

    // Archive bounties
    const archivedBounties = bounties.map(b => ({
      title: b.title,
      description: b.description,
      reward: b.reward,
      status: b.crossedOut ? 'crossed_out' : b.status,
      completedBy: b.completedBy,
      completedByName: b.completedBy ? (profileMap[b.completedBy?.toLowerCase()] || 'Unknown') : null,
      createdAt: b.createdAt
    }));

    // Archive predictions
    const archivedPredictions = predictions.map(pred => ({
      predictorWallet: pred.predictorWallet,
      predictorName: profileMap[pred.predictorWallet?.toLowerCase()] || 'Unknown',
      predictedWallet: pred.predictedWallet,
      predictedName: profileMap[pred.predictedWallet?.toLowerCase()] || 'Unknown',
      projectNumber: pred.projectNumber,
      createdAt: pred.createdAt
    }));

    // Build leaderboard snapshot (top 3 per project)
    const leaderboard = [];
    for (let projectNum = 1; projectNum <= 4; projectNum++) {
      const projectsForNum = projects
        .filter(p => p.projectNumber === projectNum)
        .sort((a, b) => (b.totalReceived || 0) - (a.totalReceived || 0))
        .slice(0, 3);

      leaderboard.push({
        projectNumber: projectNum,
        entries: projectsForNum.map((p, index) => ({
          rank: index + 1,
          authorWallet: p.authorWallet,
          authorName: profileMap[p.authorWallet?.toLowerCase()] || 'Unknown',
          title: p.title,
          totalReceived: p.totalReceived || 0
        }))
      });
    }

    // Calculate statistics
    const totalCritCoinTransferred = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Create the archive
    const archive = new SemesterArchive({
      name: dryRun ? (name?.trim() || 'DRY-RUN') : name.trim(),
      description: description?.trim() || '',
      archivedBy: req.adminWallet,
      stats: {
        totalProfiles: profiles.length,
        totalProjects: projects.length,
        totalPosts: posts.length,
        totalComments: comments.length,
        totalTransactions: transactions.length,
        totalBounties: bounties.length,
        totalPredictions: predictions.length,
        totalCritCoinTransferred
      },
      profiles: archivedProfiles,
      projects: archivedProjects,
      posts: archivedPosts,
      transactions: archivedTransactions,
      bounties: archivedBounties,
      leaderboard,
      predictions: archivedPredictions,
      predictionSettings
    });

    // Dry run: validate the fully-built document against the schema, then return
    // the same stats a real run would write — without persisting anything.
    if (dryRun) {
      await archive.validate();
      console.log('Dry-run archive inspection complete (nothing written)');
      return res.json({
        dryRun: true,
        message: 'Dry run complete — no data was written',
        stats: archive.stats,
        captured: {
          profiles: archivedProfiles.length,
          projects: archivedProjects.length,
          posts: archivedPosts.length,
          comments: comments.length,
          transactions: archivedTransactions.length,
          bounties: archivedBounties.length,
          predictions: archivedPredictions.length
        },
        predictionSettings
      });
    }

    await archive.save();

    console.log('Semester archive created successfully:', name);

    res.status(201).json({
      message: 'Semester archived successfully',
      archive: {
        _id: archive._id,
        name: archive.name,
        description: archive.description,
        archivedAt: archive.archivedAt,
        stats: archive.stats
      }
    });
  } catch (err) {
    console.error("Create archive error:", err);
    res.status(500).json({ error: 'Failed to create archive: ' + err.message });
  }
});

// POST clear current site data after archiving
router.post("/clear-current", requireAdmin, async (req, res) => {
  const { confirmed } = req.body;

  if (!confirmed) {
    return res.status(400).json({ error: 'Confirmation required to clear data' });
  }

  try {
    console.log('Starting site data clear by admin:', req.adminWallet);

    // Get admin wallet to exclude from deletion
    const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

    // Delete all profiles except admin
    const profileResult = await Profile.deleteMany({
      wallet: { $ne: ADMIN_WALLET }
    });

    // Delete all projects
    const projectResult = await Project.deleteMany({});

    // Delete all posts
    const postResult = await Post.deleteMany({});

    // Delete all comments
    const commentResult = await Comment.deleteMany({});

    // Delete all transactions
    const transactionResult = await Transaction.deleteMany({});

    // Delete all predictions
    const predictionResult = await Prediction.deleteMany({});

    // Note: Bounties are NOT deleted - they persist across semesters

    console.log('Site data cleared successfully');

    res.json({
      message: 'Site data cleared successfully',
      deleted: {
        profiles: profileResult.deletedCount,
        projects: projectResult.deletedCount,
        posts: postResult.deletedCount,
        comments: commentResult.deletedCount,
        transactions: transactionResult.deletedCount,
        predictions: predictionResult.deletedCount
      }
    });
  } catch (err) {
    console.error("Clear site data error:", err);
    res.status(500).json({ error: 'Failed to clear site data: ' + err.message });
  }
});

// POST delete an archive (admin only)
router.post("/delete", requireAdmin, async (req, res) => {
  const { archiveId } = req.body;

  if (!archiveId) {
    return res.status(400).json({ error: 'Archive ID is required' });
  }

  try {
    const archive = await SemesterArchive.findByIdAndDelete(archiveId);

    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    res.json({
      message: 'Archive deleted successfully',
      deletedArchive: {
        name: archive.name,
        archivedAt: archive.archivedAt
      }
    });
  } catch (err) {
    console.error("Delete archive error:", err);
    res.status(500).json({ error: 'Failed to delete archive' });
  }
});

// POST update archive name/description
router.post("/update", requireAdmin, async (req, res) => {
  const { archiveId, name, description } = req.body;

  if (!archiveId) {
    return res.status(400).json({ error: 'Archive ID is required' });
  }

  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();

    const archive = await SemesterArchive.findByIdAndUpdate(
      archiveId,
      updateData,
      { new: true }
    ).select('name description archivedAt stats');

    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    res.json({
      message: 'Archive updated successfully',
      archive
    });
  } catch (err) {
    console.error("Update archive error:", err);
    res.status(500).json({ error: 'Failed to update archive' });
  }
});

module.exports = router;
