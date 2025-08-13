// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
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

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://critcoin-platform.vercel.app/']
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Serve static files for profile photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes once
app.use("/api/posts", postRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/explorer", explorerRoutes);
app.use("/api/admin", adminRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
