// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Environment validation for production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['MONGO_URI', 'ADMIN_WALLET', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    console.error('💡 Please set these variables in your Railway dashboard');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
}
// Security middleware
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Routes
const profileRoutes = require("./routes/profiles");
const postRoutes = require("./routes/posts");
const projectRoutes = require("./routes/projects");
const explorerRoutes = require("./routes/explorer");
const adminRoutes = require("./routes/admin");
const commentRoutes = require("./routes/comments");
const archiveRoutes = require("./routes/archive");
const predictionRoutes = require("./routes/predictions");
const authRoutes = require("./routes/auth");
const Prediction = require("./models/Prediction");
const Transaction = require("./models/Transaction");
const Profile = require("./models/Profiles");
const Whitelist = require("./models/Whitelist");

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Secure CORS configuration.
// Note: auth is via the Authorization bearer header, not cookies, so CORS is
// browser hygiene rather than the access-control boundary (a no-Origin curl has
// no token and is rejected by requireAuth/requireAdmin). Origins never carry a
// trailing slash, so the old 'vercel.app/' entry was dead and is removed.
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://critcoin.art',
      'https://www.critcoin.art',
      'https://critcoin-platform.vercel.app'
    ].filter(Boolean)
  : [
      'http://localhost:3000', 
      'http://localhost:3001',
      'https://localhost:3000',
      'https://127.0.0.1:3000',
      'https://0.0.0.0:3000',
      'https://localhost:8080',
      'https://127.0.0.1:8080',
      'https://localhost:8443',
      'https://127.0.0.1:8443'
    ];

console.log("🔧 CORS Configuration:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("Allowed origins:", allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests without origin (like <img> tags, direct browser navigation)
    // These are safe as they can't read the response with JavaScript
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("❌ Origin blocked:", origin);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://localhost:*", "wss://localhost:*", "https://127.0.0.1:*", "https://0.0.0.0:*"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  // Allow self-signed certificates in development
  hsts: process.env.NODE_ENV === 'production' ? undefined : false
}));

// Sanitize user input to prevent NoSQL injection
app.use(mongoSanitize({
  replaceWith: '_'
}));

// Health check endpoint - declared before the rate limiter so Railway's probe
// is never throttled.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rate limiting — three tiers, tighter on the things worth abusing.
//
// Note: these are per-IP. Students on a shared campus NAT share a bucket, so the
// limits are kept generous; the real anti-abuse control is that every write now
// requires a signed-in session (middleware/auth.js). See SECURITY.md.
const isProd = process.env.NODE_ENV === 'production';

// Reads (and everything by default): generous, so image-heavy pages don't throttle.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 600 : 2000,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin in development
    return !isProd && req.path.startsWith('/api/admin');
  }
});

// Writes (any mutating method): tighter than reads.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 200 : 2000,
  message: { error: 'Too many write requests, please slow down and try again shortly' },
  standardHeaders: true,
  legacyHeaders: false,
  // Only limit mutations. Auth has its own limiter below.
  skip: (req) => req.method === 'GET' || req.method === 'OPTIONS' || req.path.startsWith('/api/auth')
});

// Sign-in: tightest. Brute force is already pointless (a valid nonce + matching
// signature is required) — this just caps flooding of the challenge endpoint.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 1000,
  message: { error: 'Too many sign-in attempts, please try again shortly' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);
app.use(writeLimiter);
app.use(express.json({ limit: '10mb' }));

// Serve static files for profile photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes once
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/explorer", explorerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/archive", archiveRoutes);
app.use("/api/predictions", predictionRoutes);

// Debug environment variables
console.log("🔍 Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
console.log("MONGO_URI preview:", process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 20) + "..." : "NOT SET");
console.log("ADMIN_WALLET:", process.env.ADMIN_WALLET);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// Validate critical environment variables
const requiredEnvVars = process.env.NODE_ENV === 'production'
  ? ['MONGO_URI', 'ADMIN_WALLET', 'JWT_SECRET']
  : ['MONGO_URI', 'ADMIN_WALLET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Create a .env file based on .env.example');
  process.exit(1);
}

// Validate admin wallet format
if (!/^0x[a-fA-F0-9]{40}$/.test(process.env.ADMIN_WALLET)) {
  console.error('❌ ADMIN_WALLET must be a valid Ethereum address');
  process.exit(1);
}

// Connect to MongoDB

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");
    console.log("Database name:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    console.error("Full error details:", JSON.stringify(err, null, 2));
    process.exit(1);
  });

// One-time migration: drop old unique index and backfill projectNumber on existing predictions
mongoose.connection.once('open', async () => {
  try {
    await mongoose.connection.collection('predictions').dropIndex('predictorWallet_1');
    console.log('✅ Dropped old predictorWallet_1 unique index');
  } catch (e) { /* index didn't exist, that's fine */ }
  const r = await Prediction.updateMany({ projectNumber: { $exists: false } }, { $set: { projectNumber: 2 } });
  if (r.modifiedCount) console.log(`✅ Migrated ${r.modifiedCount} predictions to projectNumber: 2`);

  // One-time migration: the legacy txHash_1 index was unique but not partial, so
  // only one document could ever carry txHash: null - which is why the old code
  // fabricated hashes instead of storing null. Off-chain rows (deploy credits,
  // joining credits, admin corrections) need null, so drop the legacy index and
  // rebuild the partial one declared in models/Transaction.js.
  //
  // syncIndexes() is what actually reconciles the collection with the schema.
  // Dropping alone is not enough: Mongoose's own autoIndex pass races this hook,
  // and creating a partial txHash_1 while a non-partial one still exists fails
  // with IndexOptionsConflict. Idempotent - a no-op once migrated.
  try {
    const indexes = await mongoose.connection.collection('transactions').indexes();
    const legacy = indexes.find(
      (i) => i.name === 'txHash_1' && !i.partialFilterExpression
    );
    if (legacy) {
      await mongoose.connection.collection('transactions').dropIndex('txHash_1');
      await Transaction.syncIndexes();
      console.log('✅ Replaced legacy txHash_1 index with a partial unique index');
    }
  } catch (e) {
    console.error('⚠️ txHash index migration failed:', e.message);
  }

  // One-time migration: seed the whitelist with every wallet that already has a
  // profile. The whitelist is now the always-on gate for profile creation, so
  // without this seed, current students who predate the whitelist would be locked
  // out of re-creating a profile. Idempotent: only inserts wallets not already
  // listed, so it is a no-op on every startup after the first.
  try {
    const profiles = await Profile.find({}, { wallet: 1 });
    const wallets = profiles.map((p) => p.wallet.toLowerCase());
    if (wallets.length) {
      const existing = await Whitelist.find({ wallet: { $in: wallets } }, { wallet: 1 });
      const already = new Set(existing.map((w) => w.wallet.toLowerCase()));
      const toSeed = wallets.filter((w) => !already.has(w));
      if (toSeed.length) {
        await Whitelist.insertMany(
          toSeed.map((w) => ({ wallet: w, addedBy: 'system', notes: 'Seeded from existing profile' })),
          { ordered: false }
        );
        console.log(`✅ Seeded ${toSeed.length} existing profile wallet(s) into the whitelist`);
      }
    }
  } catch (e) {
    console.error('⚠️ Whitelist seeding migration failed:', e.message);
  }
});

// Monitor MongoDB connection
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Start server
const host = process.env.NODE_ENV === 'production' ? undefined : '0.0.0.0';

app.listen(PORT, host, () => {
  const bindAddress = host || '0.0.0.0';
  console.log(`🚀 Server running on http://${bindAddress}:${PORT}`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 Also accessible at http://localhost:${PORT}`);
    console.log('⚠️  Development mode: Server accessible on all network interfaces');
  } else {
    console.log('🔒 Production mode: Server bound to Railway default interface');
  }
});
