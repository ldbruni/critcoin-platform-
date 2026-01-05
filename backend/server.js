// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Environment validation for production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['MONGO_URI', 'ADMIN_WALLET'];
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

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Secure CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      process.env.FRONTEND_URL, 
      'https://critcoin.art',
      'https://www.critcoin.art',
      'https://critcoin-platform.vercel.app',
      'https://critcoin-platform.vercel.app/'
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

// Rate limiting - more lenient in development
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // More requests allowed in dev
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin in development
    return process.env.NODE_ENV !== 'production' && req.path.startsWith('/api/admin');
  }
});

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));

// Serve static files for profile photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount routes once
app.use("/api/posts", postRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/explorer", explorerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/archive", archiveRoutes);

// Debug environment variables
console.log("🔍 Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
console.log("MONGO_URI preview:", process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 20) + "..." : "NOT SET");
console.log("ADMIN_WALLET:", process.env.ADMIN_WALLET);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// Validate critical environment variables
const requiredEnvVars = ['MONGO_URI', 'ADMIN_WALLET'];
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
