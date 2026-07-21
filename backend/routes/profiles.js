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
const { syncAdminTransfers } = require("../lib/adminGrants");
const { requireAuth } = require("../middleware/auth");
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

// Optional welcome grant issued at profile creation, gated by the admin setting
// `grantOnCreate` (default OFF). It is an off-chain adminGrant credit - admin
// intent, no on-chain counterpart - and the description doubles as its
// per-wallet idempotency key. Participation (posting, submitting) no longer
// depends on holding CritCoin, so a profile created with the toggle OFF (0 CRIT)
// can still take part; the gate is whitelist membership, not balance.
const WELCOME_GRANT_AMOUNT = 1;
const WELCOME_GRANT_DESCRIPTION = 'Welcome grant on profile creation';
const GRANT_ON_CREATE_KEY = 'grantOnCreate';


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

// Validation middleware. The wallet is the verified session wallet (req.wallet),
// not a body field — a student can only create their own profile.
const validateProfileCreation = [
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
router.post("/", requireAuth, upload.single('photo'), validateProfileCreation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const wallet = req.wallet; // a student can only create their own profile
  const { name, birthday, starSign } = req.body;

  console.log("Profile create request:", {
    wallet,
    name,
    birthday,
    starSign,
    hasPhoto: !!req.file,
    photoInfo: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null
  });

  if (!name || !birthday || !starSign)
    return res.status(400).send("Missing fields");

  try {
    const existing = await Profile.findOne({ wallet: wallet.toLowerCase() });
    if (existing) return res.status(409).send("Profile already exists");

    // The whitelist is the admission control - the class roster. Only pre-approved
    // wallets may create a profile, and this is the ONLY authorization gate:
    // membership is admin intent, checked case-insensitively (both sides
    // lowercased, matching how every wallet is normalized across the app). It is
    // never a chain-balance check - a whitelisted wallet may create a profile
    // whether it holds 0, 1 or 10,000 CritCoin. Existing students were seeded into
    // the whitelist by the boot migration in server.js so none are locked out.
    const isWhitelisted = await Whitelist.findOne({ wallet: wallet.toLowerCase() });
    if (!isWhitelisted) {
      return res.status(403).send(
        "This wallet isn't on the class roster — ask your instructor to add it."
      );
    }

    // No balance requirement to create a profile, and none to take part once it
    // exists: posting and submitting are gated on having this (whitelist-approved)
    // profile, not on holding CritCoin. The optional welcome grant below is a
    // starting bonus, not an admission requirement.

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

    // Optional welcome grant, gated by the admin `grantOnCreate` setting (default
    // OFF). When ON, credit the new profile 1 CritCoin as an off-chain adminGrant.
    // Best-effort and never blocking: the profile already saved, so a failure here
    // is logged, not surfaced - reconcile/sync will catch an uncredited student.
    // Guarded by its description so re-creating a profile never double-credits.
    try {
      const grantSetting = await SystemSettings.findOne({ key: GRANT_ON_CREATE_KEY });
      const grantOnCreate = grantSetting ? Boolean(grantSetting.value) : false;

      if (grantOnCreate) {
        const alreadyGranted = await Transaction.findOne({
          toWallet: profile.wallet,
          type: 'adminGrant',
          txHash: null,
          description: WELCOME_GRANT_DESCRIPTION
        });

        if (!alreadyGranted) {
          await Transaction.create({
            fromWallet: 'system',
            toWallet: profile.wallet,
            amount: WELCOME_GRANT_AMOUNT,
            type: 'adminGrant',
            description: WELCOME_GRANT_DESCRIPTION,
            txHash: null
          });
          console.log(`✅ Issued ${WELCOME_GRANT_AMOUNT} CritCoin welcome grant to ${profile.wallet}`);
        }
      }
    } catch (grantErr) {
      console.error("⚠️ Failed to issue welcome grant:", grantErr);
    }

    // Absorb any CritCoin the admin/deployer wallet already sent this student
    // on-chain before they onboarded (e.g. a test/welcome transfer). This records
    // the real transfer in the ledger so the on-chain grant is accounted for
    // immediately. Best-effort: a failing/unreachable RPC must never block profile
    // creation - the grant is caught later by reconcile's sync-grants action.
    try {
      const { recorded } = await syncAdminTransfers(profile.wallet);
      if (recorded.length) {
        console.log(`✅ Absorbed ${recorded.length} pre-onboarding admin grant(s) for ${profile.wallet}`);
      }
    } catch (syncErr) {
      console.error("⚠️ syncAdminTransfers failed during profile creation:", syncErr);
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
router.post("/update", requireAuth, upload.single('photo'), async (req, res) => {
  const wallet = req.wallet; // a student can only update their own profile
  const { name, birthday, starSign } = req.body;

  console.log("Profile update request:", { wallet, name, birthday, starSign });

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

// NOTE: profile archiving is an admin action and lives at
// POST /api/admin/profiles/archive (behind requireAdmin). The previously
// duplicated POST /api/profiles/archive here was gated only on a plaintext,
// publicly-known admin address (no signature), so anyone could archive any
// profile. It has been removed — use the admin route. (Audit finding F4.)

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
