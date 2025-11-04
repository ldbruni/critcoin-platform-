// Script to clear old local photo filenames from database
require("dotenv").config();
const mongoose = require("mongoose");
const Profile = require("./models/Profiles");
const Project = require("./models/Project");

async function fixOldPhotos() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("Fixing old photo URLs...\n");

    // Fix profiles with old local filenames
    const profileResult = await Profile.updateMany(
      {
        photo: {
          $exists: true,
          $ne: null,
          $not: { $regex: /^https:\/\/res\.cloudinary\.com\// }
        }
      },
      { $set: { photo: null } }
    );

    console.log(`✅ Updated ${profileResult.modifiedCount} profile(s) - cleared old photo filenames`);

    // Fix projects with old local filenames
    const projectResult = await Project.updateMany(
      {
        image: {
          $exists: true,
          $ne: null,
          $not: { $regex: /^https:\/\/res\.cloudinary\.com\// }
        }
      },
      { $set: { image: null } }
    );

    console.log(`✅ Updated ${projectResult.modifiedCount} project(s) - cleared old image filenames`);

    console.log("\n🎉 Done! Old filenames cleared. Users can now re-upload photos to Cloudinary.");

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixOldPhotos();
