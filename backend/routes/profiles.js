// backend/routes/profiles.js
const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
// Temporarily disable rate limiting
// const rateLimit = require('express-rate-limit');
const Profile = require("../models/Profiles");
const Transaction = require("../models/Transaction");
const SystemSettings = require("../models/SystemSettings");
const Whitelist = require("../models/Whitelist");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Every new profile receives this one-off ledger credit, which is what lets a
// brand-new student clear the >=1 CritCoin gate on posting and submitting.
// The description doubles as the idempotency key.
const JOINING_CREDIT_AMOUNT = 1;
const JOINING_CREDIT_DESCRIPTION = 'Joining credit for new profile';


// File type validation with magic number checking
const validateImageType = (buffer) => {
  // Check file signatures (magic numbers) for common image formats
  const signatures = {
    'jpg': [0xFF, 0xD8, 0xFF],
    'png': [0x89, 0x50, 0x4E, 0x47],
    'gif': [0x47, 0x49, 0x46],
    'webp': [0x52, 0x49, 0x46, 0x46] // RIFF (WebP starts with RIFF)
  };
  
  for (const [type, sig] of Object.entries(signatures)) {
    if (sig.every((byte, index) => buffer[index] === byte)) {
      return type;
    }
  }
  
  return null;
};

// Configure multer for file uploads with enhanced security
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // Reduced to 5MB limit
    files: 1 // Only allow 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'image/gif', 'image/webp'
    ];
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`));
    }
    
    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return cb(new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`));
    }
    
    cb(null, true);
  }
});

const uploadsDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Rate limiting temporarily disabled - dummy middleware
const uploadLimiter = (req, res, next) => next();

// Validation middleware
const validateProfileCreation = [
  body('wallet').isEthereumAddress().withMessage('Invalid wallet address'),
  body('name').isLength({ min: 1, max: 50 }).trim().escape().withMessage('Name must be 1-50 characters'),
  body('birthday').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date format (YYYY-MM-DD)'),
  body('starSign').isIn([
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ]).withMessage('Invalid star sign')
  // No balance validator: profile creation has no balance requirement, and a
  // client-supplied balance was never trustworthy anyway. See the joining
  // credit issued in POST / below.
];

// GET profile by wallet
router.get("/:wallet", [
  param('wallet').isEthereumAddress().withMessage('Invalid wallet address')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const profile = await Profile.findOne({ wallet: { $eq: req.params.wallet.toLowerCase() } });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Server error" });
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
router.post("/", uploadLimiter, upload.single('photo'), validateProfileCreation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { wallet, name, birthday, starSign } = req.body;
  
  console.log("Profile create request:", { 
    wallet, 
    name, 
    birthday, 
    starSign, 
    balance,
    hasPhoto: !!req.file,
    photoInfo: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null
  });
  
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

    // No balance requirement to create a profile. A new student has no ledger
    // history, so requiring a balance here would be unsatisfiable - they'd need
    // CritCoin to make a profile, but only profile holders get credited.
    // Instead, creating the profile issues the joining credit below, which then
    // satisfies the >=1 CritCoin gate on posting, submitting and tipping.
    // Whitelist mode (checked above) is the admission control.

    let photoUrl = null;

    // Process uploaded photo if provided
    if (req.file) {
      try {
        console.log("📸 Processing photo upload...");

        // Validate file size (already checked by multer, but double-check)
        if (req.file.size > 5 * 1024 * 1024) {
          console.log("❌ Photo too large:", req.file.size);
          return res.status(400).json({ error: "Photo file is too large (max 5MB)" });
        }

        // Validate file type using magic numbers
        const detectedType = validateImageType(req.file.buffer);
        if (!detectedType) {
          console.log("❌ Invalid image file signature");
          return res.status(400).json({ error: "Invalid image file format" });
        }

        // Verify the detected type matches the claimed MIME type
        const mimeTypeMap = {
          'jpg': ['image/jpeg', 'image/jpg'],
          'png': ['image/png'],
          'gif': ['image/gif'],
          'webp': ['image/webp']
        };

        if (!mimeTypeMap[detectedType] || !mimeTypeMap[detectedType].includes(req.file.mimetype)) {
          console.log("❌ File signature doesn't match MIME type:", detectedType, req.file.mimetype);
          return res.status(400).json({ error: "File type mismatch detected" });
        }

        console.log("📸 Uploading photo to Cloudinary...");

        // Process image with Sharp and upload to Cloudinary
        const processedImageBuffer = await sharp(req.file.buffer)
          .resize(300, 300, {
            fit: 'cover',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            mozjpeg: true
          })
          .removeAlpha()
          .toBuffer();

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'critcoin/profiles',
              public_id: `profile_${wallet.toLowerCase()}_${Date.now()}`,
              resource_type: 'image',
              transformation: [
                { width: 300, height: 300, crop: 'fill' },
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

        photoUrl = uploadResult.secure_url;
        console.log("✅ Photo uploaded to Cloudinary:", photoUrl);
      } catch (photoError) {
        console.error("❌ Photo processing error:", photoError);
        const isDevelopment = process.env.NODE_ENV === 'development';
        return res.status(500).json({
          error: isDevelopment ? photoError.message : 'Photo processing failed'
        });
      }
    } else {
      console.log("📸 No photo provided");
    }

    const profile = new Profile({
      wallet: wallet.toLowerCase(),
      name,
      birthday,
      starSign,
      photo: photoUrl
    });
    
    console.log("Attempting to save profile:", profile);
    await profile.save();
    console.log("Profile saved successfully");

    // Issue the joining credit so the new student clears the >=1 CritCoin gate
    // on posting, submitting projects and tipping. Guarded so a wallet that
    // re-creates a profile (e.g. after archiving) is never credited twice.
    //
    // This is an off-chain credit with no on-chain counterpart, so it shows up
    // as expected drift in /api/admin/reconcile. That is deliberate: it is a
    // database-only grant, exactly like an admin correction.
    try {
      const alreadyCredited = await Transaction.findOne({
        toWallet: profile.wallet,
        type: 'system',
        description: JOINING_CREDIT_DESCRIPTION
      });

      if (!alreadyCredited) {
        await Transaction.create({
          fromWallet: 'system',
          toWallet: profile.wallet,
          amount: JOINING_CREDIT_AMOUNT,
          type: 'system',
          description: JOINING_CREDIT_DESCRIPTION,
          txHash: null
        });
        console.log(`✅ Issued ${JOINING_CREDIT_AMOUNT} CritCoin joining credit to ${profile.wallet}`);
      }
    } catch (creditErr) {
      // The profile itself saved, so don't fail the request. The admin can spot
      // an uncredited student in the reconciliation report.
      console.error("⚠️ Failed to issue joining credit:", creditErr);
    }

    res.status(201).json(profile);
  } catch (err) {
    console.error("Profile create error:", err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Failed to create profile' 
    });
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
        console.log("📸 Uploading photo to Cloudinary...");

        // Process image with Sharp and upload to Cloudinary
        const processedImageBuffer = await sharp(req.file.buffer)
          .resize(300, 300, {
            fit: 'cover',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            mozjpeg: true
          })
          .removeAlpha()
          .toBuffer();

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'critcoin/profiles',
              public_id: `profile_${wallet.toLowerCase()}_${Date.now()}`,
              resource_type: 'image',
              transformation: [
                { width: 300, height: 300, crop: 'fill' },
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

        updateData.photo = uploadResult.secure_url;
        console.log("✅ Photo uploaded to Cloudinary:", uploadResult.secure_url);
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
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Failed to update profile' 
    });
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
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: isDevelopment ? err.message : 'Database error' 
    });
  }
});

// Secure file name sanitization
const sanitizeFilename = (filename) => {
  // Remove any path traversal attempts and normalize, but keep x for 0x prefix
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-x]/g, '');
  
  // Only allow specific pattern for profile photos  
  if (!sanitized.match(/^profile_0x[a-fA-F0-9]{40}_[0-9]{13}_[a-z0-9]{8,20}\.jpg$/i)) {
    console.log('❌ Filename does not match pattern:', sanitized);
    console.log('❌ Expected: profile_0x[40 hex chars]_[13 digits]_[8-20 chars].jpg');
    throw new Error('Invalid filename format');
  }
  
  return sanitized;
};

// Serve profile photos
router.get("/photo/:filename", (req, res) => {
  const filename = req.params.filename;
  
  console.log("📸 Photo request:", filename, "from:", req.get('User-Agent')?.includes('Mobile') ? 'Mobile' : 'Desktop');
  
  try {
    // Secure filename validation
    const safeFilename = sanitizeFilename(filename);
    const photoPath = path.resolve(uploadsDir, safeFilename);
    
    // Double-check that resolved path is within uploads directory
    if (!photoPath.startsWith(path.resolve(uploadsDir))) {
      console.log("❌ Path traversal attempt blocked:", filename);
      return res.status(400).send("Invalid file path");
    }
  
    if (fs.existsSync(photoPath)) {
      console.log("✅ Serving photo:", photoPath);
      
      // Set headers for better mobile compatibility
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin requests
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Use res.sendFile with absolute path for better compatibility
      const absolutePath = path.resolve(photoPath);
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error("❌ Error serving photo:", err);
          res.status(500).send("Error serving photo");
        }
      });
    } else {
      console.log("❌ Photo not found:", photoPath);
      res.status(404).send("Photo not found");
    }
  } catch (error) {
    console.log("❌ Invalid filename:", filename, error.message);
    return res.status(400).send("Invalid filename");
  }
});

module.exports = router;
