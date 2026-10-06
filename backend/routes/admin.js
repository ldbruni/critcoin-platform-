// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
// Temporarily disable rate limiting
// const rateLimit = require('express-rate-limit');
const Profile = require("../models/Profiles");
const Post = require("../models/Post");
const Bounty = require("../models/Bounty");
const Project = require("../models/Project");
const Transaction = require("../models/Transaction");
const SystemSettings = require("../models/SystemSettings");
const Whitelist = require("../models/Whitelist");
const FeedPost = require("../models/FeedPost");
const { normalizeWallet, listRoster } = require("../lib/whitelist");
const { getFeedConfig, computeQuota, isValidTimeZone } = require("../lib/feed");
const { ethers } = require('ethers');
const chain = require("../lib/chain");
const { getBalances } = require("../lib/balances");
const chainSync = require("../lib/chainSync");
const { TOGGLEABLE_PAGES, getPageVisibility, setPageVisible } = require("../lib/pageVisibility");

// Admin authentication middleware with signature verification
const authenticateAdmin = async (req, res, next) => {
  const { adminWallet, signature, message } = req.body;
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (!ADMIN_WALLET) {
    console.error('ADMIN_WALLET environment variable not set');
    return res.status(500).send('Server configuration error');
  }
  
  // For backward compatibility, allow old method in development only
  if (process.env.NODE_ENV !== 'production' && adminWallet && !signature) {
    if (adminWallet.toLowerCase() === ADMIN_WALLET) {
      console.warn('⚠️ Using insecure admin auth in development mode');
      return next();
    }
  }
  
  if (!signature || !message) {
    return res.status(403).json({ error: 'Signature and message required for admin authentication' });
  }
  
  try {
    // Parse and validate message
    let messageData;
    try {
      messageData = JSON.parse(message);
    } catch (e) {
      return res.status(403).json({ error: 'Invalid message format' });
    }
    
    // Check message timestamp (5 minutes expiry)
    if (!messageData.timestamp || Date.now() - messageData.timestamp > 300000) {
      return res.status(403).json({ error: 'Message expired or invalid timestamp' });
    }
    
    // Check action matches the request
    const expectedAction = `admin_${req.method.toLowerCase()}_${req.route?.path?.replace(/[:*]/g, '') || 'unknown'}`;
    if (messageData.action && messageData.action !== expectedAction) {
      console.warn(`Action mismatch: expected ${expectedAction}, got ${messageData.action}`);
    }
    
    // Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== ADMIN_WALLET) {
      console.warn('❌ Invalid admin signature attempt:', {
        recovered: recoveredAddress,
        expected: ADMIN_WALLET,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.status(403).json({ error: 'Invalid admin signature' });
    }
    
    // Log successful admin action
    console.log('✅ Admin authenticated:', {
      action: expectedAction,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });
    
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(403).json({ error: 'Authentication failed' });
  }
};

// Rate limiting for admin endpoints - temporarily disabled
const adminRateLimit = (req, res, next) => next(); // Dummy middleware

// Admin authentication for GET routes (uses query parameters)
const authenticateAdminGET = async (req, res, next) => {
  const { signature, message } = req.query;
  const adminWallet = req.params.adminWallet?.toLowerCase();
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
  
  if (!ADMIN_WALLET) {
    console.error('ADMIN_WALLET environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  // Verify wallet matches admin wallet first
  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).json({ error: 'Unauthorized wallet address' });
  }
  
  // For backward compatibility in development only
  if (process.env.NODE_ENV !== 'production' && !signature) {
    console.warn('⚠️ Using insecure admin auth in development mode');
    return next();
  }
  
  if (!signature || !message) {
    return res.status(403).json({ 
      error: 'Admin GET routes require signature and message query parameters',
      required: 'Add ?signature=SIGNATURE&message=MESSAGE to your request'
    });
  }
  
  try {
    // Parse and validate message
    let messageData;
    try {
      messageData = JSON.parse(decodeURIComponent(message));
    } catch (e) {
      return res.status(403).json({ error: 'Invalid message format' });
    }
    
    // Check message timestamp (5 minutes expiry)
    if (!messageData.timestamp || Date.now() - messageData.timestamp > 300000) {
      return res.status(403).json({ error: 'Message expired or invalid timestamp' });
    }
    
    // Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(
      JSON.stringify(messageData), 
      signature
    );
    
    if (recoveredAddress.toLowerCase() !== ADMIN_WALLET) {
      console.warn('❌ Invalid admin signature attempt (GET):', {
        recovered: recoveredAddress,
        expected: ADMIN_WALLET,
        ip: req.ip,
        route: req.route.path
      });
      return res.status(403).json({ error: 'Invalid admin signature' });
    }
    
    // Log successful admin action
    console.log('✅ Admin authenticated (GET):', {
      route: req.route.path,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });
    
    next();
  } catch (error) {
    console.error('Admin GET authentication error:', error);
    return res.status(403).json({ error: 'Authentication failed' });
  }
};

// GET admin dashboard data
router.get("/dashboard/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const adminWallet = req.params.adminWallet.toLowerCase();

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
    const totalProjects = await Project.countDocuments();
    const archivedProjects = await Project.countDocuments({ archived: true });

    res.json({
      profiles: { 
        total: totalProfiles, 
        totalExcludingAdmin: totalProfilesExcludingAdmin,
        archived: archivedProfiles 
      },
      posts: { total: totalPosts, hidden: hiddenPosts },
      bounties: { total: totalBounties, active: activeBounties },
      projects: { total: totalProjects, archived: archivedProjects }
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Server error' 
    });
  }
});

// GET all profiles for admin management
router.get("/profiles/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const profiles = await Profile.find().sort({ createdAt: -1 });
    res.json(profiles);
  } catch (err) {
    console.error("Profiles fetch error:", err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Server error' 
    });
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
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Database error' 
    });
  }
});

// GET all posts for admin management
router.get("/posts/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
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
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Server error' 
    });
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
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Database error' 
    });
  }
});

// GET all bounties
router.get("/bounties/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
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

// POST delete bounty
router.post("/bounties/delete", authenticateAdmin, async (req, res) => {
  const { bountyId } = req.body;
  
  if (!bountyId) {
    return res.status(400).send("Bounty ID required");
  }

  try {
    const bounty = await Bounty.findByIdAndDelete(bountyId);
    
    if (!bounty) {
      return res.status(404).send("Bounty not found");
    }

    res.json({ 
      message: "Bounty deleted successfully",
      deletedBounty: bounty 
    });
  } catch (err) {
    console.error("Delete bounty error:", err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Database error' 
    });
  }
});

// ---------------------------------------------------------------------------
// Deploy CritCoin - the profile checklist
//
// The deploy itself runs entirely in the admin's browser: MetaMask preflights
// and signs each transfer, and the Etherscan sync imports them as adminGrant
// rows. The backend only supplies the checklist - read-only, no RPC.
//
//   GET /deploy/roster/:adminWallet  active profiles + adminGrants received
// ---------------------------------------------------------------------------
router.get("/deploy/roster/:adminWallet", [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  try {
    const profiles = await Profile.find({ archived: { $ne: true } })
      .select("wallet name").sort({ name: 1 }).lean();
    const wallets = profiles.map((p) => p.wallet.toLowerCase());

    // Transactions are cleared at each semester reset, so every adminGrant
    // still in the ledger was received this semester.
    const grants = await Transaction.aggregate([
      { $match: { type: 'adminGrant', toWallet: { $in: wallets } } },
      { $group: { _id: "$toWallet", amount: { $sum: "$amount" }, count: { $sum: 1 }, hashes: { $push: "$txHash" } } }
    ]);
    const byWallet = new Map(grants.map((g) => [g._id, g]));

    const admin = process.env.ADMIN_WALLET.toLowerCase();
    res.json({
      students: profiles.map((p) => {
        const wallet = p.wallet.toLowerCase();
        const grant = byWallet.get(wallet);
        return {
          wallet,
          name: p.name,
          isAdmin: wallet === admin,
          granted: grant ? grant.amount : 0,
          grantCount: grant ? grant.count : 0,
          // Lets the browser tell which of its sends the sync has imported.
          grantHashes: grant ? grant.hashes.filter(Boolean) : []
        };
      })
    });
  } catch (err) {
    console.error("Deploy roster error:", err);
    res.status(500).json({ error: "Failed to load the deploy roster" });
  }
});

// ---------------------------------------------------------------------------
// GET reconciliation report - DIAGNOSTIC ONLY
//
// Compares the authoritative database ledger against live on-chain balances and
// reports the difference. This endpoint is strictly read-only: it must never
// write to the database and never send a transaction. Drift is surfaced here so
// a human can decide what to do; it is never auto-corrected. See CLAUDE.md.
// ---------------------------------------------------------------------------
router.get("/reconcile/:adminWallet", [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const profiles = await Profile.find({ archived: { $ne: true } }).sort({ name: 1 });
    const balances = await getBalances(profiles.map((p) => p.wallet));

    const chainAvailable = chain.isConfigured();

    const students = await Promise.all(
      profiles.map(async (profile) => {
        const address = profile.wallet.toLowerCase();
        const db = balances.get(address)?.balance ?? 0;
        const onChain = chainAvailable ? await chain.getCritBalance(address) : null;

        return {
          name: profile.name,
          wallet: address,
          dbBalance: db,
          chainBalance: onChain,
          // Positive drift means the ledger credits more than the chain holds.
          drift: onChain === null ? null : db - onChain
        };
      })
    );

    const [missingHashes, fabricatedHashes] = await Promise.all([
      Transaction.countDocuments({ txHash: null }),
      Transaction.countDocuments({ hashFabricated: true })
    ]);

    res.json({
      // False when SEPOLIA_RPC_URL is unset or the RPC is unreachable. Database
      // numbers are still returned; chainBalance and drift come back null.
      // With an empty roster there is nothing to probe, so configuration alone
      // decides.
      chainAvailable: chainAvailable &&
        (students.length === 0 || students.some((s) => s.chainBalance !== null)),
      contractAddress: chain.contractAddress,
      students,
      transactionHashes: {
        missing: missingHashes,
        fabricated: fabricatedHashes
      },
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Reconcile error:", err);
    res.status(500).json({ error: "Failed to build reconciliation report" });
  }
});

// ---------------------------------------------------------------------------
// Sync from Chain: import on-chain CritCoin transfers as Transaction rows
//
// Reads transfers from the Etherscan API (no RPC). Preview writes nothing;
// commit imports, saves the active critique project and start time, and those
// settings drive the automatic sync from then on. See lib/chainSync.js.
//
//   GET  /chain-sync/status/:adminWallet   saved settings, last auto-sync
//   GET  /chain-sync/preview/:adminWallet  ?since=ISO&project=N - no writes
//   POST /chain-sync/commit                { since, project }
//   POST /chain-sync/run                   import now, with the saved settings
// ---------------------------------------------------------------------------

const parseSyncParams = (since, project) => {
  const sinceDate = new Date(since);
  const activeProject = parseInt(project, 10);
  if (!since || isNaN(sinceDate.getTime())) return { error: "A valid start time is required" };
  if (!(activeProject >= 1 && activeProject <= 5)) return { error: "Active critique project must be 1-5" };
  return { since: sinceDate.toISOString(), activeProject };
};

router.get("/chain-sync/status/:adminWallet", [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  try {
    res.json({
      configured: chainSync.isConfigured(),
      settings: await chainSync.getSyncSettings(),
      lastAutoSync: chainSync.getLastAutoSync()
    });
  } catch (err) {
    console.error("Chain sync status error:", err);
    res.status(500).json({ error: "Failed to fetch chain sync status" });
  }
});

router.get("/chain-sync/preview/:adminWallet", [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const params = parseSyncParams(req.query.since, req.query.project);
  if (params.error) return res.status(400).json({ error: params.error });

  try {
    res.json(await chainSync.planSync(params));
  } catch (err) {
    console.error("Chain sync preview error:", err);
    res.status(502).json({ error: `Chain sync preview failed: ${err.message}` });
  }
});

router.post("/chain-sync/commit", authenticateAdmin, async (req, res) => {
  const params = parseSyncParams(req.body.since, req.body.project);
  if (params.error) return res.status(400).json({ error: params.error });

  try {
    const result = await chainSync.commitSync(params);
    await chainSync.saveSyncSettings(params, req.body.adminWallet);
    res.json(result);
  } catch (err) {
    console.error("Chain sync commit error:", err);
    res.status(502).json({ error: `Chain sync failed: ${err.message}` });
  }
});

// Run the sync now with the saved settings - what the auto-sync does, on demand.
// Used right after a browser deploy so the grants appear without the 5-minute wait.
router.post("/chain-sync/run", authenticateAdmin, async (req, res) => {
  try {
    const settings = await chainSync.getSyncSettings();
    if (!settings.activeProject || !settings.since) {
      return res.status(409).json({ error: "Sync from Chain has never been confirmed - run it once from its tab first" });
    }
    res.json(await chainSync.commitSync(settings));
  } catch (err) {
    console.error("Chain sync run error:", err);
    res.status(502).json({ error: `Chain sync failed: ${err.message}` });
  }
});

// POST manual adjustment: a ledger-only correction for a mistake that cannot be
// fixed on-chain. Positive credits the wallet, negative debits it. Affects
// balance only; never counts as an investment.
router.post("/ledger/adjust", authenticateAdmin, async (req, res) => {
  const { wallet, amount, note } = req.body;
  const address = String(wallet || '').toLowerCase();
  const value = Number(amount);

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  if (!Number.isSafeInteger(value) || value === 0) {
    return res.status(400).json({ error: "Amount must be a non-zero whole number" });
  }
  if (!note || !String(note).trim()) {
    return res.status(400).json({ error: "A note is required" });
  }

  try {
    if (!(await Profile.exists({ wallet: address }))) {
      return res.status(404).json({ error: "No profile for that wallet" });
    }
    const transaction = await Transaction.create({
      fromWallet: value > 0 ? 'system' : address,
      toWallet: value > 0 ? address : 'system',
      amount: Math.abs(value),
      type: 'manualAdjustment',
      description: `Manual adjustment: ${String(note).trim()}`,
      txHash: null
    });
    res.json({ transaction, balance: (await getBalances([address])).get(address).balance });
  } catch (err) {
    console.error("Manual adjustment error:", err);
    res.status(500).json({ error: "Failed to record adjustment" });
  }
});

// GET all projects for admin management
router.get("/projects/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    
    // Enrich with profile data
    const profiles = await Profile.find();
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    const enrichedProjects = projects.map(project => {
      const profile = profileMap[project.authorWallet?.toLowerCase()];
      return {
        ...project.toObject(),
        authorName: profile?.name || project.authorWallet || "Unknown"
      };
    });

    res.json(enrichedProjects);
  } catch (err) {
    console.error("Projects fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST archive/unarchive project
router.post("/projects/archive", authenticateAdmin, async (req, res) => {
  const { projectId, archive } = req.body;
  
  if (!projectId) {
    return res.status(400).send("Project ID required");
  }

  try {
    const project = await Project.findByIdAndUpdate(
      projectId,
      { archived: archive },
      { new: true }
    );
    
    if (!project) {
      return res.status(404).send("Project not found");
    }

    res.json({ 
      message: `Project ${archive ? 'archived' : 'unarchived'} successfully`,
      project 
    });
  } catch (err) {
    console.error("Archive project error:", err);
    res.status(500).send("Database error");
  }
});

// GET The Feed with full authorship, plus each poster's quota. The public feed
// never carries the author; this is the instructor's normal view of the same
// rows. Hidden posts are included and flagged.
router.get("/feed/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [posts, profiles, roster, config] = await Promise.all([
      FeedPost.find().sort({ createdAt: -1 }).lean(),
      Profile.find().lean(),
      listRoster(),
      getFeedConfig()
    ]);
    const nameByWallet = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p.name])
    );
    const labelByWallet = Object.fromEntries(
      roster.map(w => [w.wallet, w.label])
    );
    const displayName = (wallet) => nameByWallet[wallet] || labelByWallet[wallet] || wallet;

    const createdAtsByAuthor = {};
    posts.forEach(p => {
      (createdAtsByAuthor[p.authorWallet] = createdAtsByAuthor[p.authorWallet] || []).push(p.createdAt);
    });

    // Every roster member appears, including those who have not posted.
    const authors = new Set([...roster.map(w => w.wallet), ...Object.keys(createdAtsByAuthor)]);
    const quotas = [...authors].map(wallet => ({
      authorWallet: wallet,
      authorName: displayName(wallet),
      ...computeQuota(createdAtsByAuthor[wallet] || [], config)
    })).sort((a, b) => a.authorName.localeCompare(b.authorName));

    res.json({
      config,
      quotas,
      posts: posts.map(p => ({ ...p, authorName: displayName(p.authorWallet) }))
    });
  } catch (err) {
    console.error("Feed admin fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST The Feed's run configuration, all four keys under one signature
router.post("/feed/settings", authenticateAdmin, async (req, res) => {
  const { runStart, runDays, dailyTarget, timeZone, adminWallet } = req.body;

  if (runStart && !/^\d{4}-\d{2}-\d{2}$/.test(runStart)) {
    return res.status(400).json({ error: "Run start must be a YYYY-MM-DD date" });
  }
  const days = parseInt(runDays, 10);
  const target = parseInt(dailyTarget, 10);
  if (!(days > 0 && days <= 366) || !(target > 0 && target <= 1000)) {
    return res.status(400).json({ error: "Run days and daily target must be positive whole numbers" });
  }
  if (!isValidTimeZone(timeZone)) {
    return res.status(400).json({ error: "Unknown time zone - use an IANA name like America/New_York" });
  }

  try {
    const values = { feedRunStart: runStart || null, feedRunDays: days, feedDailyTarget: target, feedTimeZone: timeZone };
    await Promise.all(Object.entries(values).map(([key, value]) =>
      SystemSettings.findOneAndUpdate(
        { key },
        { value, updatedAt: new Date(), updatedBy: adminWallet.toLowerCase() },
        { upsert: true }
      )
    ));
    res.json({ message: "Feed settings updated", config: await getFeedConfig() });
  } catch (err) {
    console.error("Feed settings error:", err);
    res.status(500).send("Database error");
  }
});

// POST hide/unhide a feed post
router.post("/feed/hide", authenticateAdmin, async (req, res) => {
  const { postId, hide } = req.body;

  if (!postId) {
    return res.status(400).send("Post ID required");
  }

  try {
    const post = await FeedPost.findByIdAndUpdate(
      postId,
      { hidden: Boolean(hide), hiddenAt: hide ? new Date() : null },
      { new: true }
    );

    if (!post) {
      return res.status(404).send("Post not found");
    }

    res.json({ message: `Feed post ${hide ? 'hidden' : 'unhidden'} successfully`, post });
  } catch (err) {
    console.error("Hide feed post error:", err);
    res.status(500).send("Database error");
  }
});

// GET system settings
router.get("/settings/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const settings = await SystemSettings.find();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json(settingsObj);
  } catch (err) {
    console.error("Settings fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST update system setting
router.post("/settings", authenticateAdmin, async (req, res) => {
  const { key, value, adminWallet } = req.body;
  
  if (!key) {
    return res.status(400).send("Setting key required");
  }

  try {
    await SystemSettings.findOneAndUpdate(
      { key },
      { 
        value, 
        updatedAt: new Date(),
        updatedBy: adminWallet.toLowerCase()
      },
      { upsert: true, new: true }
    );
    
    res.json({ message: `Setting ${key} updated successfully` });
  } catch (err) {
    console.error("Update setting error:", err);
    res.status(500).send("Database error");
  }
});

// POST show or hide a live page for students
router.post("/page-visibility", authenticateAdmin, async (req, res) => {
  const { page, visible, adminWallet } = req.body;

  if (!TOGGLEABLE_PAGES[page] || typeof visible !== "boolean") {
    return res.status(400).json({ error: "Unknown page or invalid visibility" });
  }

  try {
    const visibility = await setPageVisible(page, visible, adminWallet);
    res.json({ message: `${TOGGLEABLE_PAGES[page]} is now ${visible ? "visible to" : "hidden from"} students`, visibility });
  } catch (err) {
    console.error("Page visibility error:", err);
    res.status(500).send("Database error");
  }
});

// GET whitelist
router.get("/whitelist/:adminWallet", adminRateLimit, [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const whitelist = await Whitelist.find().sort({ addedAt: -1 });
    res.json(whitelist);
  } catch (err) {
    console.error("Whitelist fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST add wallet to whitelist
router.post("/whitelist/add", authenticateAdmin, async (req, res) => {
  const { wallet, label, notes, adminWallet } = req.body;
  
  if (!wallet) {
    return res.status(400).send("Wallet address required");
  }

  // Reject malformed addresses here rather than storing a roster entry that
  // could never match a real wallet.
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(wallet).trim())) {
    return res.status(400).send("Invalid Ethereum address");
  }

  try {
    const whitelistEntry = new Whitelist({
      wallet: normalizeWallet(wallet),
      label: label || "",
      addedBy: normalizeWallet(adminWallet),
      notes: notes || ""
    });
    
    await whitelistEntry.save();
    res.json({ message: "Wallet added to whitelist successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).send("Wallet already whitelisted");
    }
    console.error("Add to whitelist error:", err);
    res.status(500).send("Database error");
  }
});

// POST remove wallet from whitelist
router.post("/whitelist/remove", authenticateAdmin, async (req, res) => {
  const { wallet } = req.body;
  
  if (!wallet) {
    return res.status(400).send("Wallet address required");
  }

  try {
    const result = await Whitelist.findOneAndDelete({
      wallet: normalizeWallet(wallet)
    });
    
    if (!result) {
      return res.status(404).send("Wallet not found in whitelist");
    }
    
    res.json({ message: "Wallet removed from whitelist successfully" });
  } catch (err) {
    console.error("Remove from whitelist error:", err);
    res.status(500).send("Database error");
  }
});

// Public endpoint - which toggleable pages students can see (nav + route gate)
router.get("/public/page-visibility", async (req, res) => {
  try {
    res.json({ pages: TOGGLEABLE_PAGES, visibility: await getPageVisibility() });
  } catch (err) {
    console.error("Page visibility fetch error:", err);
    res.status(500).json({ error: "Failed to fetch page visibility" });
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