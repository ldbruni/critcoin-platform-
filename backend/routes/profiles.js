// backend/routes/profiles.js
const express = require("express");
const router = express.Router();
const Profile = require("../models/Profiles");
const SystemSettings = require("../models/SystemSettings");
const Whitelist = require("../models/Whitelist");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");

// Load contract info
const contractInfo = require("../sepolia.json");

// Helper function to check CritCoin balance
async function checkCritCoinBalance(walletAddress) {
  try {
    // For now, we'll skip the actual blockchain call and assume validation happens on frontend
    // In production, you'd want to verify this on-chain
    return true; // Assume balance check passes for now
  } catch (error) {
    console.error("Balance check failed:", error);
    return false;
  }
}

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

const uploadsDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// GET profile by wallet
router.get("/:wallet", async (req, res) => {
  try {
    const profile = await Profile.findOne({ wallet: req.params.wallet.toLowerCase() });
    if (!profile) return res.status(404).send("Profile not found");
    res.json(profile);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).send("Server error");
  }
});

// GET all profiles (non-archived)
router.get("/", async (req, res) => {
  try {
    const profiles = await Profile.find({ archived: { $ne: true } });
    res.json(profiles);
  } catch (err) {
    console.error("Get all profiles error:", err);
    res.status(500).send("Server error");
  }
});

// POST create profile with optional photo
router.post("/", upload.single('photo'), async (req, res) => {
  const { wallet, name, birthday, starSign, balance } = req.body;
  
  console.log("Profile create request:", { wallet, name, birthday, starSign, balance });
  
  if (!wallet || !name || !birthday || !starSign)
    return res.status(400).send("Missing fields");

  try {
    const existing = await Profile.findOne({ wallet: wallet.toLowerCase() });
    if (existing) return res.status(409).send("Profile already exists");

    // Check whitelist mode
    const whitelistSetting = await SystemSettings.findOne({ key: 'whitelistMode' });
    const isWhitelistMode = whitelistSetting ? whitelistSetting.value : false;
    
    if (isWhitelistMode) {
      const isWhitelisted = await Whitelist.findOne({ wallet: wallet.toLowerCase() });
      if (!isWhitelisted) {
        return res.status(403).send("Profile creation restricted to whitelisted wallets only");
      }
    }

    // Check CritCoin balance requirement (frontend should pass balance for verification)
    if (!balance || Number(balance) < 1) {
      return res.status(400).send("Need ≥1 CritCoin to create profile");
    }

    let photoFilename = null;
    
    // Process uploaded photo if provided
    if (req.file) {
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        photoFilename = `profile_${wallet.toLowerCase()}_${timestamp}_${randomString}.jpg`;
        const photoPath = path.join(uploadsDir, photoFilename);
        
        // Process and save image using Sharp (resize to 300x300, compress)
        await sharp(req.file.buffer)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(photoPath);
          
        console.log("Photo saved successfully:", photoFilename);
      } catch (photoError) {
        console.error("Photo processing error:", photoError);
        // Continue without photo if processing fails
        photoFilename = null;
      }
    }

    const profile = new Profile({ 
      wallet: wallet.toLowerCase(), 
      name, 
      birthday, 
      starSign,
      photo: photoFilename 
    });
    
    console.log("Attempting to save profile:", profile);
    await profile.save();
    console.log("Profile saved successfully");
    
    res.status(201).json(profile);
  } catch (err) {
    console.error("Profile create error:", err);
    res.status(500).send(`Database error: ${err.message}`);
  }
});

// POST update profile with optional photo
router.post("/update", upload.single('photo'), async (req, res) => {
  const { wallet, name, birthday, starSign } = req.body;
  
  console.log("Profile update request:", { wallet, name, birthday, starSign });
  
  if (!wallet) return res.status(400).send("Wallet required");

  try {
    const updateData = { name, birthday, starSign };
    
    // Process uploaded photo if provided
    if (req.file) {
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const photoFilename = `profile_${wallet.toLowerCase()}_${timestamp}_${randomString}.jpg`;
        const photoPath = path.join(uploadsDir, photoFilename);
        
        // Process and save image using Sharp (resize to 300x300, compress)
        await sharp(req.file.buffer)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(photoPath);
          
        // Add photo to update data
        updateData.photo = photoFilename;
        console.log("Photo saved successfully:", photoFilename);
        
        // Optional: Delete old photo file if it exists
        const existingProfile = await Profile.findOne({ wallet: wallet.toLowerCase() });
        if (existingProfile?.photo) {
          const oldPhotoPath = path.join(uploadsDir, existingProfile.photo);
          try {
            if (fs.existsSync(oldPhotoPath)) {
              fs.unlinkSync(oldPhotoPath);
              console.log("Old photo deleted:", existingProfile.photo);
            }
          } catch (deleteError) {
            console.warn("Could not delete old photo:", deleteError.message);
          }
        }
      } catch (photoError) {
        console.error("Photo processing error:", photoError);
        // Continue without updating photo if processing fails
      }
    }

    const updated = await Profile.findOneAndUpdate(
      { wallet: wallet.toLowerCase() },
      updateData,
      { new: true }
    );
    if (!updated) return res.status(404).send("Profile not found");
    
    console.log("Profile updated successfully:", updated);
    res.json(updated);
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).send(`Database error: ${err.message}`);
  }
});

// POST archive profile (admin only)
router.post("/archive", async (req, res) => {
  const { wallet, adminWallet } = req.body;
  const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

  if (!wallet || !adminWallet)
    return res.status(400).send("Missing fields");
  if (adminWallet.toLowerCase() !== ADMIN_WALLET)
    return res.status(403).send("Unauthorized");

  try {
    const profile = await Profile.findOneAndUpdate(
      { wallet: wallet.toLowerCase() },
      { archived: true },
      { new: true }
    );
    if (!profile) return res.status(404).send("Profile not found");
    res.json({ message: "Profile archived", profile });
  } catch (err) {
    console.error("Archive error:", err);
    res.status(500).send("Database error");
  }
});

// Serve profile photos
router.get("/photo/:filename", (req, res) => {
  const filename = req.params.filename;
  
  // Basic security: only allow certain file extensions and prevent path traversal
  if (!filename.match(/^profile_[a-zA-Z0-9_]+\.(jpg|jpeg|png)$/i)) {
    return res.status(400).send("Invalid filename");
  }
  
  const photoPath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(photoPath)) {
    // Set appropriate content type
    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(photoPath);
  } else {
    res.status(404).send("Photo not found");
  }
});

module.exports = router;
