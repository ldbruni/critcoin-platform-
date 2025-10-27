// backend/routes/projects.js
const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const Profile = require("../models/Profiles");
const Transaction = require("../models/Transaction");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Load contract info
const contractInfo = require("../sepolia.json");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const uploadsDir = path.join(__dirname, '../uploads/projects');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// GET leaderboard - top 3 projects for each project number
// IMPORTANT: This must be BEFORE /:projectNumber route to avoid route collision
router.get("/leaderboard/top", async (req, res) => {
  try {
    const leaderboard = {};

    // Get top 3 for each project number (1-4)
    for (let projectNumber = 1; projectNumber <= 4; projectNumber++) {
      const topProjects = await Project.find({
        projectNumber,
        archived: { $ne: true }
      })
      .sort({ totalReceived: -1 })
      .limit(3);

      // Enrich with profile data
      const enrichedProjects = await Promise.all(
        topProjects.map(async (project) => {
          const profile = await Profile.findOne({
            wallet: project.authorWallet.toLowerCase(),
            archived: { $ne: true }
          });

          const walletAddress = project.authorWallet;
          const displayName = profile?.name ||
            (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Unknown");

          return {
            _id: project._id,
            title: project.title,
            image: project.image,
            totalReceived: project.totalReceived,
            authorName: displayName,
            authorPhoto: profile?.photo,
            authorWallet: project.authorWallet
          };
        })
      );

      leaderboard[`project${projectNumber}`] = enrichedProjects;
    }

    res.json(leaderboard);
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    res.status(500).send("Failed to fetch leaderboard");
  }
});

// GET all projects for a specific project number
router.get("/:projectNumber", async (req, res) => {
  const projectNumber = parseInt(req.params.projectNumber);
  if (!projectNumber || projectNumber < 1 || projectNumber > 4) {
    return res.status(400).send("Invalid project number");
  }

  try {
    // Only show non-archived projects to the public
    const projects = await Project.find({ 
      projectNumber, 
      archived: { $ne: true } 
    }).sort({ createdAt: -1 });
    
    // Enrich with profile data
    const profiles = await Profile.find({ archived: { $ne: true } });
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    const enrichedProjects = projects.map(project => {
      const profile = profileMap[project.authorWallet?.toLowerCase()];
      const walletAddress = project.authorWallet;
      const displayName = profile?.name || 
        (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Unknown");
      
      return {
        ...project.toObject(),
        authorName: displayName,
        authorPhoto: profile?.photo
      };
    });

    res.json(enrichedProjects);
  } catch (err) {
    console.error("Failed to fetch projects:", err);
    res.status(500).send("Failed to fetch projects");
  }
});

// GET specific project by wallet and project number
router.get("/:projectNumber/:wallet", async (req, res) => {
  const projectNumber = parseInt(req.params.projectNumber);
  const wallet = req.params.wallet.toLowerCase();

  try {
    // Only return non-archived projects
    const project = await Project.findOne({ 
      projectNumber, 
      authorWallet: wallet,
      archived: { $ne: true }
    });
    if (!project) return res.status(404).send("Project not found");
    res.json(project);
  } catch (err) {
    console.error("Project fetch error:", err);
    res.status(500).send("Server error");
  }
});

// POST create or update project submission
router.post("/", upload.single('image'), async (req, res) => {
  const { wallet, projectNumber, title, description, balance } = req.body;
  const projNum = parseInt(projectNumber);

  if (!wallet || !projNum || !title || !req.file) {
    return res.status(400).send("Missing required fields");
  }

  if (projNum < 1 || projNum > 4) {
    return res.status(400).send("Invalid project number");
  }

  // Check if user has a profile
  try {
    const profile = await Profile.findOne({ wallet: wallet.toLowerCase() });
    if (!profile) {
      return res.status(400).send("Must have a profile to submit projects");
    }

    // Check balance requirement
    if (!balance || Number(balance) < 1) {
      return res.status(400).send("Need ≥1 CritCoin to submit projects");
    }

    console.log("🖼️ Uploading project image to Cloudinary...");

    // Process and upload image to Cloudinary - accommodate phone photos
    // Max dimensions: 1920px, maintain aspect ratio
    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'critcoin/projects',
          public_id: `project_${wallet.toLowerCase()}_${projNum}_${Date.now()}`,
          resource_type: 'image',
          transformation: [
            { width: 1920, height: 1920, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(processedImageBuffer);
    });

    const imageUrl = uploadResult.secure_url;
    console.log("✅ Project image uploaded to Cloudinary:", imageUrl);

    // Check if project already exists (update) or create new
    let project = await Project.findOne({
      authorWallet: wallet.toLowerCase(),
      projectNumber: projNum
    });

    if (project) {
      // Update existing project
      project.title = title;
      project.description = description || "";
      project.image = imageUrl;
      project.updatedAt = new Date();
      await project.save();
    } else {
      // Create new project
      project = new Project({
        authorWallet: wallet.toLowerCase(),
        projectNumber: projNum,
        title,
        description: description || "",
        image: imageUrl
      });
      await project.save();
    }

    res.json(project);
  } catch (err) {
    console.error("Project submission error:", err);
    res.status(500).send("Database error");
  }
});

// POST send CritCoin to project author
router.post("/send-coin", async (req, res) => {
  const { fromWallet, toWallet, amount, projectId } = req.body;
  
  if (!fromWallet || !toWallet || !amount || !projectId) {
    return res.status(400).send("Missing required fields");
  }

  try {
    // Find the project to update total received
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send("Project not found");
    }

    // In a real implementation, you'd interact with the smart contract here
    // For now, we'll just update the total received amount
    project.totalReceived += Number(amount);
    await project.save();

    // Log the transaction
    const transaction = new Transaction({
      fromWallet: fromWallet.toLowerCase(),
      toWallet: toWallet.toLowerCase(),
      amount: Number(amount),
      type: 'project_tip',
      description: `Tip for project: ${project.title}`,
      relatedId: projectId,
      txHash: `0x${Math.random().toString(16).substr(2, 64)}` // Generate fake hash for demo
    });
    await transaction.save();

    res.json({ 
      message: "CritCoin sent successfully",
      totalReceived: project.totalReceived,
      transactionId: transaction._id
    });
  } catch (err) {
    console.error("Send coin error:", err);
    res.status(500).send("Failed to send CritCoin");
  }
});

// Secure file name sanitization for project images
const sanitizeProjectFilename = (filename) => {
  // Remove any path traversal attempts and normalize, but keep x for 0x prefix
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-x]/g, '');

  // Only allow specific pattern for project images: project_0x[wallet]_[timestamp]_[random].jpg
  // Pattern: project_0x[40 hex chars]_[13 digits]_[8-20 chars].jpg
  if (!sanitized.match(/^project_0x[a-fA-F0-9]{40}_[0-9]{13}_[a-z0-9]{8,20}\.jpg$/i)) {
    console.log('❌ Filename does not match pattern:', sanitized);
    console.log('❌ Expected: project_0x[40 hex chars]_[13 digits]_[8-20 chars].jpg');
    throw new Error('Invalid project image filename format');
  }

  return sanitized;
};

// Serve project images
router.get("/image/:filename", (req, res) => {
  const filename = req.params.filename;

  console.log("🖼️ Project image request:", filename, "from:", req.get('User-Agent')?.includes('Mobile') ? 'Mobile' : 'Desktop');

  try {
    // Secure filename validation
    const safeFilename = sanitizeProjectFilename(filename);
    const imagePath = path.resolve(uploadsDir, safeFilename);

    // Double-check that resolved path is within uploads directory
    if (!imagePath.startsWith(path.resolve(uploadsDir))) {
      console.log("❌ Path traversal attempt blocked:", filename);
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (fs.existsSync(imagePath)) {
      console.log("✅ Serving project image:", imagePath);

      // Set headers for better mobile compatibility and CORS
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin requests
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Use absolute path for sendFile
      const absolutePath = path.resolve(imagePath);
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error("❌ Error serving project image:", err);
          res.status(500).json({ error: "Error serving image" });
        }
      });
    } else {
      console.log("❌ Project image not found:", imagePath);
      res.status(404).json({ error: "Image not found" });
    }
  } catch (error) {
    console.log("❌ Invalid project image filename:", filename, error.message);
    return res.status(400).json({ error: "Invalid filename" });
  }
});

module.exports = router;