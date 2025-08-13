// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const Profile = require("../models/Profiles");
const Post = require("../models/Post");
const Bounty = require("../models/Bounty");
const Transaction = require("../models/Transaction");

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const { adminWallet } = req.body;
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (!adminWallet || adminWallet.toLowerCase() !== ADMIN_WALLET) {
    return res.status(403).send("Unauthorized: Admin access required");
  }
  
  next();
};

// GET admin dashboard data
router.get("/dashboard/:adminWallet", async (req, res) => {
  const adminWallet = req.params.adminWallet.toLowerCase();
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).send("Unauthorized");
  }

  try {
    // Get counts for dashboard
    const totalProfiles = await Profile.countDocuments({ archived: { $ne: true } });
    const totalProfilesExcludingAdmin = await Profile.countDocuments({ 
      archived: { $ne: true },
      wallet: { $ne: adminWallet }
    });
    const archivedProfiles = await Profile.countDocuments({ archived: true });
    const totalPosts = await Post.countDocuments();
    const hiddenPosts = await Post.countDocuments({ hidden: true });
    const totalBounties = await Bounty.countDocuments();
    const activeBounties = await Bounty.countDocuments({ status: 'active' });

    res.json({
      profiles: { 
        total: totalProfiles, 
        totalExcludingAdmin: totalProfilesExcludingAdmin,
        archived: archivedProfiles 
      },
      posts: { total: totalPosts, hidden: hiddenPosts },
      bounties: { total: totalBounties, active: activeBounties }
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).send("Server error");
  }
});

// GET all profiles for admin management
router.get("/profiles/:adminWallet", async (req, res) => {
  const adminWallet = req.params.adminWallet.toLowerCase();
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).send("Unauthorized");
  }

  try {
    const profiles = await Profile.find().sort({ createdAt: -1 });
    res.json(profiles);
  } catch (err) {
    console.error("Profiles fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST archive/unarchive profile
router.post("/profiles/archive", authenticateAdmin, async (req, res) => {
  const { wallet, archive } = req.body;
  
  if (!wallet) {
    return res.status(400).send("Wallet required");
  }

  try {
    const profile = await Profile.findOneAndUpdate(
      { wallet: wallet.toLowerCase() },
      { archived: archive },
      { new: true }
    );
    
    if (!profile) {
      return res.status(404).send("Profile not found");
    }

    res.json({ 
      message: `Profile ${archive ? 'archived' : 'unarchived'} successfully`,
      profile 
    });
  } catch (err) {
    console.error("Archive profile error:", err);
    res.status(500).send("Database error");
  }
});

// GET all posts for admin management
router.get("/posts/:adminWallet", async (req, res) => {
  const adminWallet = req.params.adminWallet.toLowerCase();
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).send("Unauthorized");
  }

  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    
    // Enrich with profile data
    const profiles = await Profile.find();
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    const enrichedPosts = posts.map(post => {
      const profile = profileMap[post.authorWallet?.toLowerCase()];
      return {
        ...post.toObject(),
        authorName: profile?.name || post.authorWallet || "Unknown"
      };
    });

    res.json(enrichedPosts);
  } catch (err) {
    console.error("Posts fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST hide/unhide post
router.post("/posts/hide", authenticateAdmin, async (req, res) => {
  const { postId, hide } = req.body;
  
  if (!postId) {
    return res.status(400).send("Post ID required");
  }

  try {
    const post = await Post.findByIdAndUpdate(
      postId,
      { hidden: hide },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).send("Post not found");
    }

    res.json({ 
      message: `Post ${hide ? 'hidden' : 'unhidden'} successfully`,
      post 
    });
  } catch (err) {
    console.error("Hide post error:", err);
    res.status(500).send("Database error");
  }
});

// GET all bounties
router.get("/bounties/:adminWallet", async (req, res) => {
  const adminWallet = req.params.adminWallet.toLowerCase();
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).send("Unauthorized");
  }

  try {
    const bounties = await Bounty.find().sort({ createdAt: -1 });
    res.json(bounties);
  } catch (err) {
    console.error("Bounties fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST create bounty
router.post("/bounties", authenticateAdmin, async (req, res) => {
  const { title, description, reward, adminWallet } = req.body;
  
  if (!title || !description || !reward) {
    return res.status(400).send("Missing required fields");
  }

  try {
    const bounty = new Bounty({
      title,
      description,
      reward: Number(reward),
      createdBy: adminWallet.toLowerCase()
    });
    
    await bounty.save();
    res.status(201).json(bounty);
  } catch (err) {
    console.error("Create bounty error:", err);
    res.status(500).send("Database error");
  }
});

// POST update bounty
router.post("/bounties/update", authenticateAdmin, async (req, res) => {
  const { bountyId, title, description, reward } = req.body;
  
  if (!bountyId) {
    return res.status(400).send("Bounty ID required");
  }

  try {
    const updateData = { updatedAt: new Date() };
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (reward) updateData.reward = Number(reward);

    const bounty = await Bounty.findByIdAndUpdate(
      bountyId,
      updateData,
      { new: true }
    );
    
    if (!bounty) {
      return res.status(404).send("Bounty not found");
    }

    res.json({ message: "Bounty updated successfully", bounty });
  } catch (err) {
    console.error("Update bounty error:", err);
    res.status(500).send("Database error");
  }
});

// POST cross out bounty
router.post("/bounties/cross-out", authenticateAdmin, async (req, res) => {
  const { bountyId, crossOut, adminWallet } = req.body;
  
  if (!bountyId) {
    return res.status(400).send("Bounty ID required");
  }

  try {
    const updateData = {
      crossedOut: crossOut,
      updatedAt: new Date()
    };
    
    if (crossOut) {
      updateData.crossedOutBy = adminWallet.toLowerCase();
      updateData.crossedOutAt = new Date();
      updateData.status = 'crossed_out';
    } else {
      updateData.crossedOutBy = null;
      updateData.crossedOutAt = null;
      updateData.status = 'active';
    }

    const bounty = await Bounty.findByIdAndUpdate(
      bountyId,
      updateData,
      { new: true }
    );
    
    if (!bounty) {
      return res.status(404).send("Bounty not found");
    }

    res.json({ 
      message: `Bounty ${crossOut ? 'crossed out' : 'restored'} successfully`,
      bounty 
    });
  } catch (err) {
    console.error("Cross out bounty error:", err);
    res.status(500).send("Database error");
  }
});

// POST deploy CritCoin to all active profiles (excluding admin)
router.post("/deploy-critcoin", authenticateAdmin, async (req, res) => {
  const { adminWallet, confirmed } = req.body;
  
  if (!confirmed) {
    return res.status(400).send("Confirmation required");
  }

  try {
    // Get all active profiles excluding the admin's profile
    const activeProfiles = await Profile.find({ 
      archived: { $ne: true },
      wallet: { $ne: adminWallet.toLowerCase() } // Exclude admin wallet
    });
    
    if (activeProfiles.length === 0) {
      return res.status(400).send("No active profiles found (excluding admin)");
    }

    const amount = 10000;
    const transactions = [];

    // Create transactions for each profile (excluding admin)
    for (const profile of activeProfiles) {
      const transaction = new Transaction({
        fromWallet: 'system',
        toWallet: profile.wallet,
        amount: amount,
        type: 'system',
        description: 'CritCoin deployment to all active profiles (excluding admin)',
        txHash: `0x${Math.random().toString(16).substr(2, 64)}`
      });
      
      transactions.push(transaction);
    }

    // Save all transactions
    await Transaction.insertMany(transactions);

    res.json({
      message: "CritCoin deployed successfully to all active profiles (admin excluded)",
      recipients: activeProfiles.length,
      totalDeployed: activeProfiles.length * amount,
      amountPerProfile: amount,
      excludedAdmin: true
    });
  } catch (err) {
    console.error("Deploy CritCoin error:", err);
    res.status(500).send("Failed to deploy CritCoin");
  }
});

// Public endpoint - GET active bounties (non-admin)
router.get("/public/bounties", async (req, res) => {
  try {
    console.log("🎯 Fetching public bounties...");
    // Only show active, non-crossed-out bounties to the public
    const bounties = await Bounty.find({ 
      status: 'active',
      crossedOut: { $ne: true }
    }).sort({ createdAt: -1 });
    console.log(`🎯 Found ${bounties.length} public bounties`);
    
    res.json(bounties);
  } catch (err) {
    console.error("❌ Public bounties fetch error:", err);
    res.status(500).send("Failed to fetch bounties");
  }
});

module.exports = router;