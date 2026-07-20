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
const { REAL_TX_HASH } = require("../models/Transaction");
const Deploy = require("../models/Deploy");
const SystemSettings = require("../models/SystemSettings");
const Whitelist = require("../models/Whitelist");
const { ethers } = require('ethers');
const chain = require("../lib/chain");
const { getBalances } = require("../lib/balances");

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
// Deploy CritCoin
//
// A deploy credits the database ledger AND transfers real tokens on Sepolia.
// Signing happens in the browser with the admin's MetaMask wallet - the backend
// holds no private key. The split of responsibility is:
//
//   POST /deploy/start   preflight, create/resume the round, credit Mongo
//   (browser)            transfer to each student sequentially, awaiting each
//   POST /deploy/record  store the real hash, or the failure, per student
//   GET  /deploy/latest  the status table
//
// Re-running is safe: already-credited students are never credited twice, and
// chain_confirmed students are skipped entirely.
// ---------------------------------------------------------------------------

const DEFAULT_DEPLOY_AMOUNT = 10000;

// POST start (or resume) a deploy round
router.post("/deploy/start", authenticateAdmin, async (req, res) => {
  const { adminWallet, confirmed, resume } = req.body;
  const amountPerStudent = Number(req.body.amountPerStudent) || DEFAULT_DEPLOY_AMOUNT;

  if (!confirmed) {
    return res.status(400).json({ error: "Confirmation required" });
  }
  if (!Number.isInteger(amountPerStudent) || amountPerStudent <= 0) {
    return res.status(400).json({ error: "amountPerStudent must be a positive whole number" });
  }

  try {
    // The deployer is the admin wallet, whose control authenticateAdmin has just
    // proven via signature. Tokens are sent from this wallet in the browser.
    const deployer = process.env.ADMIN_WALLET.toLowerCase();

    let deploy = null;
    const unfinished = await Deploy.findOne({ status: 'in_progress' }).sort({ createdAt: -1 });

    if (resume) {
      if (!unfinished) {
        return res.status(400).json({ error: "No in-progress deploy to resume" });
      }
      deploy = unfinished;
    } else if (unfinished) {
      // Refuse to open a second round while one is unfinished. Without this, an
      // admin re-clicking Deploy after a crash would credit everyone a second
      // time. Resuming is the only way forward, so a crash can never double-credit.
      return res.status(409).json({
        error: "A deploy is already in progress - resume it instead of starting a new one",
        deployId: unfinished._id,
        awaiting: unfinished.rows.filter(
          (r) => r.status === 'pending' || r.status === 'credited'
        ).length,
        failed: unfinished.rows.filter((r) => r.status === 'chain_failed').length,
        hint: "Use the Resume deploy button. Starting fresh would credit these students twice."
      });
    }

    // Roster for a new round: every active profile except the admin's own.
    let roster;
    if (deploy) {
      roster = deploy.rows.map((r) => ({ wallet: r.wallet, name: r.name }));
    } else {
      const activeProfiles = await Profile.find({
        archived: { $ne: true },
        wallet: { $ne: deployer }
      });
      if (activeProfiles.length === 0) {
        return res.status(400).json({ error: "No active profiles found (excluding admin)" });
      }
      roster = activeProfiles.map((p) => ({ wallet: p.wallet.toLowerCase(), name: p.name }));
    }

    // --- Preflight: abort loudly BEFORE any write ---------------------------
    // Only students still needing an on-chain transfer count toward the cost.
    const owing = deploy
      ? deploy.rows.filter((r) => r.status !== 'chain_confirmed')
      : roster;

    if (!chain.isConfigured()) {
      return res.status(503).json({
        error: "SEPOLIA_RPC_URL is not configured - cannot verify the deployer wallet before deploying",
        hint: "Set SEPOLIA_RPC_URL on the server, or the deploy would run blind."
      });
    }

    const requiredCrit = owing.length * amountPerStudent;
    const critBalance = await chain.getCritBalance(deployer);
    const ethBalance = await chain.getEthBalance(deployer);
    const perTransferCost = await chain.estimateTransferCost({
      from: deployer,
      to: owing[0]?.wallet,
      amount: amountPerStudent
    });

    if (critBalance === null || ethBalance === null || perTransferCost === null) {
      return res.status(503).json({
        error: "Sepolia RPC unreachable - refusing to deploy without a preflight check"
      });
    }

    if (critBalance < requiredCrit) {
      return res.status(400).json({
        error: "Deployer wallet has insufficient CritCoin",
        required: requiredCrit,
        available: critBalance,
        shortfall: requiredCrit - critBalance,
        students: owing.length,
        amountPerStudent
      });
    }

    const requiredWei = perTransferCost
      .mul(owing.length)
      .mul(Math.round(chain.GAS_SAFETY_MARGIN * 100))
      .div(100);

    if (ethBalance.lt(requiredWei)) {
      return res.status(400).json({
        error: "Deployer wallet has insufficient Sepolia ETH for gas",
        requiredEth: ethers.utils.formatEther(requiredWei),
        availableEth: ethers.utils.formatEther(ethBalance),
        students: owing.length,
        note: `Includes a ${chain.GAS_SAFETY_MARGIN}x safety margin`
      });
    }
    // --- Preflight passed. Writes begin below. -----------------------------

    if (!deploy) {
      deploy = new Deploy({
        createdBy: deployer,
        amountPerStudent,
        rows: roster.map((r) => ({ wallet: r.wallet, name: r.name, status: 'pending' }))
      });
    }

    // Credit the database ledger. Skip anyone already credited so a resumed or
    // re-run deploy can never double-credit.
    let credited = 0;
    for (const row of deploy.rows) {
      if (row.status !== 'pending') continue;

      const transaction = await Transaction.create({
        fromWallet: 'system',
        toWallet: row.wallet,
        amount: deploy.amountPerStudent,
        type: 'system',
        description: 'CritCoin deployment to all active profiles (excluding admin)',
        txHash: null
      });

      row.creditTxId = transaction._id;
      row.creditedAt = new Date();
      row.status = 'credited';
      credited += 1;
    }

    deploy.refreshStatus();
    await deploy.save();

    res.json({
      deployId: deploy._id,
      amountPerStudent: deploy.amountPerStudent,
      credited,
      preflight: {
        deployer,
        critBalance,
        requiredCrit,
        ethBalance: ethers.utils.formatEther(ethBalance),
        requiredEth: ethers.utils.formatEther(requiredWei)
      },
      // Everyone the browser still needs to transfer to, in order.
      rows: deploy.rows.map((r) => ({
        wallet: r.wallet,
        name: r.name,
        status: r.status,
        txHash: r.txHash,
        error: r.error
      }))
    });
  } catch (err) {
    console.error("Deploy start error:", err);
    res.status(500).json({ error: "Failed to start deploy" });
  }
});

// POST record the on-chain outcome for one student
router.post("/deploy/record", authenticateAdmin, async (req, res) => {
  const { deployId, wallet, txHash, error } = req.body;

  if (!deployId || !wallet) {
    return res.status(400).json({ error: "deployId and wallet are required" });
  }

  try {
    const deploy = await Deploy.findById(deployId);
    if (!deploy) {
      return res.status(404).json({ error: "Deploy not found" });
    }

    const row = deploy.rows.find((r) => r.wallet === wallet.toLowerCase());
    if (!row) {
      return res.status(404).json({ error: "Wallet is not part of this deploy" });
    }

    if (txHash) {
      if (!REAL_TX_HASH.test(txHash)) {
        return res.status(400).json({ error: "Malformed transaction hash - refusing to store" });
      }
      row.txHash = txHash.toLowerCase();
      row.status = 'chain_confirmed';
      row.error = null;
      row.confirmedAt = new Date();

      // Attach the real hash to the ledger row this deploy created, so the
      // Explorer can link the credit straight to Etherscan.
      if (row.creditTxId) {
        await Transaction.findByIdAndUpdate(row.creditTxId, {
          txHash: row.txHash,
          hashFabricated: false
        });
      }
    } else {
      row.status = 'chain_failed';
      // Truncated: provider errors can be enormous, and the row is a status
      // record, not a log.
      row.error = String(error || "Unknown error").slice(0, 500);
    }

    deploy.refreshStatus();
    await deploy.save();

    res.json({ wallet: row.wallet, status: row.status, deployStatus: deploy.status });
  } catch (err) {
    console.error("Deploy record error:", err);
    res.status(500).json({ error: "Failed to record deploy result" });
  }
});

// GET the most recent deploy, for the admin status table
router.get("/deploy/latest/:adminWallet", [
  param('adminWallet').isEthereumAddress().withMessage('Invalid wallet address')
], authenticateAdminGET, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const deploy = await Deploy.findOne().sort({ createdAt: -1 });
    if (!deploy) return res.json({ deploy: null });

    res.json({
      deploy: {
        _id: deploy._id,
        status: deploy.status,
        amountPerStudent: deploy.amountPerStudent,
        createdAt: deploy.createdAt,
        completedAt: deploy.completedAt,
        rows: deploy.rows,
        summary: {
          total: deploy.rows.length,
          confirmed: deploy.rows.filter((r) => r.status === 'chain_confirmed').length,
          failed: deploy.rows.filter((r) => r.status === 'chain_failed').length,
          awaiting: deploy.rows.filter(
            (r) => r.status === 'pending' || r.status === 'credited'
          ).length
        }
      }
    });
  } catch (err) {
    console.error("Deploy latest fetch error:", err);
    res.status(500).json({ error: "Failed to fetch deploy status" });
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
    
    // Default values if not set
    if (!settingsObj.hasOwnProperty('whitelistMode')) {
      settingsObj.whitelistMode = false;
    }
    
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
  const { wallet, notes, adminWallet } = req.body;
  
  if (!wallet) {
    return res.status(400).send("Wallet address required");
  }

  try {
    const whitelistEntry = new Whitelist({
      wallet: wallet.toLowerCase(),
      addedBy: adminWallet.toLowerCase(),
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
      wallet: wallet.toLowerCase() 
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