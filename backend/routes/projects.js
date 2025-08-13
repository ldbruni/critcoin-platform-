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

// GET all projects for a specific project number
router.get("/:projectNumber", async (req, res) => {
  const projectNumber = parseInt(req.params.projectNumber);
  if (!projectNumber || projectNumber < 1 || projectNumber > 4) {
    return res.status(400).send("Invalid project number");
  }

  try {
    const projects = await Project.find({ projectNumber }).sort({ createdAt: -1 });
    
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
    const project = await Project.findOne({ projectNumber, authorWallet: wallet });
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

    const imageFilename = `${wallet.toLowerCase()}_project${projNum}.jpg`;
    const imagePath = path.join(uploadsDir, imageFilename);

    // Process and save image (max 1080x1080)
    await sharp(req.file.buffer)
      .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(imagePath);

    // Check if project already exists (update) or create new
    let project = await Project.findOne({ 
      authorWallet: wallet.toLowerCase(), 
      projectNumber: projNum 
    });

    if (project) {
      // Update existing project
      project.title = title;
      project.description = description || "";
      project.image = imageFilename;
      project.updatedAt = new Date();
      await project.save();
    } else {
      // Create new project
      project = new Project({
        authorWallet: wallet.toLowerCase(),
        projectNumber: projNum,
        title,
        description: description || "",
        image: imageFilename
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

// Serve project images
router.get("/image/:filename", (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).send("Image not found");
  }
});

module.exports = router;