const express = require("express");
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Prediction = require("../models/Prediction");
const Profile = require("../models/Profiles");
const SystemSettings = require("../models/SystemSettings");

// Validation middleware
const validatePrediction = [
  body('predictorWallet').isEthereumAddress().withMessage('Invalid predictor wallet address'),
  body('predictedWallet').isEthereumAddress().withMessage('Invalid predicted wallet address'),
  body('projectNumber').optional().isInt({ min: 2, max: 4 }).withMessage('Project number must be 2, 3, or 4')
];

// GET public prediction enabled settings — MUST be before /check/:wallet
router.get("/settings", async (req, res) => {
  try {
    const keys = ["predictionEnabled2", "predictionEnabled3", "predictionEnabled4"];
    const docs = await SystemSettings.find({ key: { $in: keys } });
    const result = { predictionEnabled2: true, predictionEnabled3: true, predictionEnabled4: true };
    docs.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    console.error("Failed to fetch prediction settings:", err);
    res.status(500).json({ error: "Failed to fetch prediction settings" });
  }
});

// GET all predictions with enriched profile data (filter by project)
router.get("/", async (req, res) => {
  try {
    const projectNumber = parseInt(req.query.project) || 2;
    const predictions = await Prediction.find({ projectNumber, archived: { $ne: true } });

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

// GET check if user has already made a prediction (filter by project)
router.get("/check/:wallet", async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const projectNumber = parseInt(req.query.project) || 2;
    const prediction = await Prediction.findOne({
      predictorWallet: wallet,
      projectNumber,
      archived: { $ne: true }
    });

    if (prediction) {
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

// POST create a new prediction (ONE TIME PER PROJECT)
router.post("/", validatePrediction, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { predictorWallet, predictedWallet, projectNumber = 2 } = req.body;
  const predictorLower = predictorWallet.toLowerCase();
  const predictedLower = predictedWallet.toLowerCase();

  try {
    // 1. Check if predictions are enabled for this project
    const enabledSetting = await SystemSettings.findOne({ key: `predictionEnabled${projectNumber}` });
    if (enabledSetting && enabledSetting.value === false) {
      return res.status(403).json({ error: `Predictions for Project ${projectNumber} are currently closed.` });
    }

    // 2. Verify predictor has an active profile
    const predictorProfile = await Profile.findOne({
      wallet: predictorLower,
      archived: { $ne: true }
    });

    if (!predictorProfile) {
      return res.status(403).json({ error: "Must have an active profile to make predictions" });
    }

    // 3. Verify predicted user has an active profile
    const predictedProfile = await Profile.findOne({
      wallet: predictedLower,
      archived: { $ne: true }
    });

    if (!predictedProfile) {
      return res.status(400).json({ error: "Selected user must have an active profile" });
    }

    // 4. Check if user already made a prediction for this project
    const existingPrediction = await Prediction.findOne({
      predictorWallet: predictorLower,
      projectNumber,
      archived: { $ne: true }
    });

    if (existingPrediction) {
      return res.status(409).json({
        error: `You have already made a prediction for Project ${projectNumber}. Predictions cannot be changed.`,
        existingPrediction: existingPrediction.predictedWallet
      });
    }

    // 5. Create the prediction
    const prediction = new Prediction({
      predictorWallet: predictorLower,
      predictedWallet: predictedLower,
      projectNumber
    });

    await prediction.save();

    console.log(`Project ${projectNumber} prediction: ${predictorProfile.name} → ${predictedProfile.name}`);

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
        error: `You have already made a prediction for Project ${projectNumber}. Predictions cannot be changed.`
      });
    }

    console.error("Prediction creation error:", err);
    res.status(500).json({ error: "Failed to create prediction" });
  }
});

module.exports = router;
