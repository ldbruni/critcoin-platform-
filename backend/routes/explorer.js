// backend/routes/explorer.js
const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Profile = require("../models/Profiles");

// GET all transactions with pagination
router.get("/transactions", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Filter by wallet address
    if (req.query.wallet) {
      const wallet = req.query.wallet.toLowerCase();
      filter.$or = [
        { fromWallet: wallet },
        { toWallet: wallet }
      ];
    }
    
    // Filter by transaction type
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    // Date range filter
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
    }

    const transactions = await Transaction.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments(filter);

    // Enrich with profile data
    const profiles = await Profile.find({ archived: { $ne: true } });
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    const enrichedTransactions = transactions.map(tx => {
      const fromProfile = profileMap[tx.fromWallet];
      const toProfile = profileMap[tx.toWallet];
      
      const fromDisplayName = fromProfile?.name || 
        (tx.fromWallet === 'system' ? 'System' : 
         tx.fromWallet ? `${tx.fromWallet.slice(0, 6)}...${tx.fromWallet.slice(-4)}` : "Unknown");
      
      const toDisplayName = toProfile?.name || 
        (tx.toWallet === 'system' ? 'System' : 
         tx.toWallet ? `${tx.toWallet.slice(0, 6)}...${tx.toWallet.slice(-4)}` : "Unknown");
      
      return {
        ...tx.toObject(),
        fromName: fromDisplayName,
        toName: toDisplayName,
        fromPhoto: fromProfile?.photo,
        toPhoto: toProfile?.photo
      };
    });

    // If no transactions exist, create some sample data for testing
    if (total === 0 && process.env.NODE_ENV !== 'production') {
      console.log('🔍 No transactions found, consider using admin CritCoin deployment to create initial transactions');
    }

    res.json({
      transactions: enrichedTransactions,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
        totalTransactions: total
      }
    });
  } catch (err) {
    console.error("Failed to fetch transactions:", err);
    res.status(500).send("Failed to fetch transactions");
  }
});

// GET specific transaction by ID
router.get("/transaction/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    // Enrich with profile data
    const profiles = await Profile.find({ 
      wallet: { $in: [transaction.fromWallet, transaction.toWallet] },
      archived: { $ne: true }
    });
    
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.wallet.toLowerCase(), p])
    );

    const fromProfile = profileMap[transaction.fromWallet];
    const toProfile = profileMap[transaction.toWallet];

    const fromDisplayName = fromProfile?.name || 
      (transaction.fromWallet === 'system' ? 'System' : 
       transaction.fromWallet ? `${transaction.fromWallet.slice(0, 6)}...${transaction.fromWallet.slice(-4)}` : "Unknown");
    
    const toDisplayName = toProfile?.name || 
      (transaction.toWallet === 'system' ? 'System' : 
       transaction.toWallet ? `${transaction.toWallet.slice(0, 6)}...${transaction.toWallet.slice(-4)}` : "Unknown");

    const enrichedTransaction = {
      ...transaction.toObject(),
      fromName: fromDisplayName,
      toName: toDisplayName,
      fromPhoto: fromProfile?.photo,
      toPhoto: toProfile?.photo
    };

    res.json(enrichedTransaction);
  } catch (err) {
    console.error("Transaction fetch error:", err);
    res.status(500).send("Server error");
  }
});

// GET transaction statistics
router.get("/stats", async (req, res) => {
  try {
    const totalTransactions = await Transaction.countDocuments();
    const totalVolume = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransactions = await Transaction.countDocuments({
      timestamp: { $gte: last24h }
    });

    const recentVolume = await Transaction.aggregate([
      {
        $match: { timestamp: { $gte: last24h } }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const typeDistribution = await Transaction.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          volume: { $sum: "$amount" }
        }
      }
    ]);

    res.json({
      totalTransactions,
      totalVolume: totalVolume[0]?.total || 0,
      last24h: {
        transactions: recentTransactions,
        volume: recentVolume[0]?.total || 0
      },
      typeDistribution
    });
  } catch (err) {
    console.error("Stats fetch error:", err);
    res.status(500).send("Failed to fetch statistics");
  }
});

// GET transactions for specific wallet
router.get("/wallet/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({
      $or: [
        { fromWallet: address },
        { toWallet: address }
      ]
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Transaction.countDocuments({
      $or: [
        { fromWallet: address },
        { toWallet: address }
      ]
    });

    // Calculate wallet statistics
    const sentStats = await Transaction.aggregate([
      { $match: { fromWallet: address } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: "$amount" }
        }
      }
    ]);

    const receivedStats = await Transaction.aggregate([
      { $match: { toWallet: address } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: "$amount" }
        }
      }
    ]);

    res.json({
      transactions,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
        totalTransactions: total
      },
      stats: {
        sent: {
          count: sentStats[0]?.count || 0,
          total: sentStats[0]?.total || 0
        },
        received: {
          count: receivedStats[0]?.count || 0,
          total: receivedStats[0]?.total || 0
        }
      }
    });
  } catch (err) {
    console.error("Wallet transactions fetch error:", err);
    res.status(500).send("Failed to fetch wallet transactions");
  }
});

// POST create sample transactions (development only)
router.post("/sample-data", async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).send("Sample data creation not allowed in production");
  }

  try {
    // Check if transactions already exist
    const existingCount = await Transaction.countDocuments();
    if (existingCount > 0) {
      return res.json({ 
        message: "Sample data already exists", 
        existingTransactions: existingCount 
      });
    }

    // Get some profiles to use for sample data
    const profiles = await Profile.find({ archived: { $ne: true } }).limit(5);
    
    if (profiles.length < 2) {
      return res.status(400).json({ 
        error: "Need at least 2 profiles to create sample transactions. Create some profiles first." 
      });
    }

    const sampleTransactions = [];
    const types = ['transfer', 'project_tip', 'forum_reward', 'system'];
    
    // Create 20 sample transactions
    for (let i = 0; i < 20; i++) {
      const fromProfile = profiles[Math.floor(Math.random() * profiles.length)];
      let toProfile = profiles[Math.floor(Math.random() * profiles.length)];
      
      // Ensure different from and to
      while (toProfile.wallet === fromProfile.wallet) {
        toProfile = profiles[Math.floor(Math.random() * profiles.length)];
      }
      
      const type = types[Math.floor(Math.random() * types.length)];
      const amount = Math.floor(Math.random() * 100) + 1; // 1-100 CC
      
      // Random timestamp within last 30 days
      const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      sampleTransactions.push({
        fromWallet: fromProfile.wallet,
        toWallet: toProfile.wallet,
        amount: amount,
        type: type,
        description: `Sample ${type.replace('_', ' ')} transaction`,
        status: 'completed',
        timestamp: timestamp
      });
    }

    // Add a few system transactions
    sampleTransactions.push({
      fromWallet: 'system',
      toWallet: profiles[0].wallet,
      amount: 1000,
      type: 'system',
      description: 'Initial CritCoin deployment',
      status: 'completed',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    });

    await Transaction.insertMany(sampleTransactions);

    res.json({
      message: "Sample transaction data created successfully",
      transactionsCreated: sampleTransactions.length,
      note: "Visit the Explorer page to see the sample transactions"
    });
  } catch (err) {
    console.error("Failed to create sample data:", err);
    res.status(500).send("Failed to create sample data");
  }
});

module.exports = router;