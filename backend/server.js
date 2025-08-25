// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Routes
const profileRoutes = require("./routes/profiles");
const postRoutes = require("./routes/posts");
const projectRoutes = require("./routes/projects");
const explorerRoutes = require("./routes/explorer");
const adminRoutes = require("./routes/admin");

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
      'https://critcoin-platform.vercel.app',
      'https://critcoin-platform.vercel.app/'
    ].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

console.log("🔧 CORS Configuration:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("Allowed origins:", allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // In production, never allow requests with no origin
    if (!origin && process.env.NODE_ENV === 'production') {
      console.log("❌ No origin in production - blocked");
      return callback(new Error('Not allowed by CORS - no origin'));
    }
    
    // Allow no origin only in development
    if (!origin && process.env.NODE_ENV !== 'production') {
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
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Sanitize user input to prevent NoSQL injection
app.use(mongoSanitize());

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
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

// Debug environment variables
console.log("🔍 Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
console.log("MONGO_URI preview:", process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 20) + "..." : "NOT SET");
console.log("ADMIN_WALLET:", process.env.ADMIN_WALLET);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// Connect to MongoDB
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI environment variable is not set!");
  process.exit(1);
}

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
