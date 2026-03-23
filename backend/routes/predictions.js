const express = require("express");
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Prediction = require("../models/Prediction");
const Profile = require("../models/Profiles");

// Validation middleware
const validatePrediction = [
  body('predictorWallet').isEthereumAddress().withMessage('Invalid predictor wallet address'),
  body('predictedWallet').isEthereumAddress().withMessage('Invalid predicted wallet address')
];

// GET all predictions with enriched profile data
router.get("/", async (req, res) => {
  try {
    const predictions = await Prediction.find({ archived: { $ne: true } });

    // Get all active profiles for enrichment
    const profiles = await Profile.find({ archived: { $ne: true } });
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    // Enrich predictions with profile info
    const enrichedPredictions = predictions.map(pred => {
      const predictorProfile = profileMap[pred.predictorWallet];
      const predictedProfile = profileMap[pred.predictedWallet];

      return {
        ...pred.toObject(),
        predictorName: predictorProfile?.name || pred.predictorWallet.slice(0, 10) + '...',
        predictorPhoto: predictorProfile?.photo,
        predictedName: predictedProfile?.name || pred.predictedWallet.slice(0, 10) + '...',
        predictedPhoto: predictedProfile?.photo
      };
    });

    res.json(enrichedPredictions);
  } catch (err) {
    console.error("Failed to fetch predictions:", err);
    res.status(500).json({ error: "Failed to fetch predictions" });
  }
});

// GET check if user has already made a prediction
router.get("/check/:wallet", async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const prediction = await Prediction.findOne({
      predictorWallet: wallet,
      archived: { $ne: true }
    });

    if (prediction) {
      // Enrich with predicted profile info
      const predictedProfile = await Profile.findOne({
        wallet: prediction.predictedWallet,
        archived: { $ne: true }
      });

      res.json({
        hasPrediction: true,
        prediction: {
          ...prediction.toObject(),
          predictedName: predictedProfile?.name || prediction.predictedWallet.slice(0, 10) + '...',
          predictedPhoto: predictedProfile?.photo
        }
      });
    } else {
      res.json({ hasPrediction: false });
    }
  } catch (err) {
    console.error("Failed to check prediction:", err);
    res.status(500).json({ error: "Failed to check prediction" });
  }
});

// POST create a new prediction (ONE TIME ONLY)
router.post("/", validatePrediction, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { predictorWallet, predictedWallet } = req.body;
  const predictorLower = predictorWallet.toLowerCase();
  const predictedLower = predictedWallet.toLowerCase();

  try {
    // 1. Verify predictor has an active profile
    const predictorProfile = await Profile.findOne({
      wallet: predictorLower,
      archived: { $ne: true }
    });

    if (!predictorProfile) {
      return res.status(403).json({ error: "Must have an active profile to make predictions" });
    }

    // 2. Verify predicted user has an active profile
    const predictedProfile = await Profile.findOne({
      wallet: predictedLower,
      archived: { $ne: true }
    });

    if (!predictedProfile) {
      return res.status(400).json({ error: "Selected user must have an active profile" });
    }

    // 3. Check if user already made a prediction
    const existingPrediction = await Prediction.findOne({
      predictorWallet: predictorLower,
      archived: { $ne: true }
    });

    if (existingPrediction) {
      return res.status(409).json({
        error: "You have already made a prediction. Predictions cannot be changed.",
        existingPrediction: existingPrediction.predictedWallet
      });
    }

    // 5. Create the prediction
    const prediction = new Prediction({
      predictorWallet: predictorLower,
      predictedWallet: predictedLower
    });

    await prediction.save();

    console.log(`Prediction created: ${predictorProfile.name} predicted ${predictedProfile.name}`);

    res.status(201).json({
      ...prediction.toObject(),
      predictorName: predictorProfile.name,
      predictedName: predictedProfile.name,
      predictedPhoto: predictedProfile.photo
    });
  } catch (err) {
    // Handle duplicate key error (race condition protection)
    if (err.code === 11000) {
      return res.status(409).json({
        error: "You have already made a prediction. Predictions cannot be changed."
      });
    }

    console.error("Prediction creation error:", err);
    res.status(500).json({ error: "Failed to create prediction" });
  }
});

module.exports = router;
