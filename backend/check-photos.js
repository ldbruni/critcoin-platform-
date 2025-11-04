// Quick script to check photo URLs in database
require("dotenv").config();
const mongoose = require("mongoose");
const Profile = require("./models/Profiles");
const Project = require("./models/Project");

async function checkPhotos() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check profiles
    console.log("=== PROFILES ===");
    const profiles = await Profile.find({ photo: { $exists: true, $ne: null } }).limit(5);
    console.log(`Found ${profiles.length} profiles with photos:\n`);

    profiles.forEach((prof, i) => {
      console.log(`${i + 1}. ${prof.name}`);
      console.log(`   Photo: ${prof.photo}`);
      console.log(`   Is Cloudinary URL: ${prof.photo?.startsWith('https://res.cloudinary.com/')}`);
      console.log();
    });

    // Check projects
    console.log("=== PROJECTS ===");
    const projects = await Project.find({ image: { $exists: true, $ne: null } }).limit(5);
    console.log(`Found ${projects.length} projects with images:\n`);

    projects.forEach((proj, i) => {
      console.log(`${i + 1}. ${proj.title}`);
      console.log(`   Image: ${proj.image}`);
      console.log(`   Is Cloudinary URL: ${proj.image?.startsWith('https://res.cloudinary.com/')}`);
      console.log();
    });

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkPhotos();
