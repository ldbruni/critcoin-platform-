// Simple test server to isolate issues
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3002;

// Basic CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test server working!' });
});

// Profile model
const Profile = mongoose.model('Profile', new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  birthday: { type: String, required: true },
  starSign: { type: String, required: true },
  photo: { type: String },
  archived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

// Simple profiles route
app.get('/api/profiles', async (req, res) => {
  try {
    const profiles = await Profile.find({ archived: { $ne: true } }).sort({ createdAt: -1 });
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
});