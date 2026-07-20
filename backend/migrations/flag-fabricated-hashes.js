// One-off migration: label legacy Transaction rows whose txHash was fabricated.
//
// Before the ledger-authority refactor, /api/projects/send-coin and
// /api/admin/deploy-critcoin both wrote `0x${Math.random().toString(16).substr(2,64)}`
// instead of a real hash. Math.random().toString(16) yields ~19 characters, so
// those values are ~19 characters long while a genuine Sepolia hash is exactly
// 66 (0x + 64 hex). That difference identifies them with no guesswork.
//
// The fabricated values are left in place - only the hashFabricated flag is set,
// so the Explorer can label them "legacy - no on-chain record" instead of
// linking to an Etherscan page that resolves to nothing.
//
// Idempotent: re-running reports 0 modified.
//
// Usage (from backend/):  node migrations/flag-fabricated-hashes.js
//                         node migrations/flag-fabricated-hashes.js --dry-run

require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { REAL_TX_HASH } = require("../models/Transaction");

const DRY_RUN = process.argv.includes("--dry-run");

async function flagFabricatedHashes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log(DRY_RUN ? "🔍 DRY RUN - no writes\n" : "");

    const total = await Transaction.countDocuments();

    // A row needs flagging when it has a hash that isn't a real one and isn't
    // already flagged. Rows with txHash: null are legitimately off-chain and
    // are left alone.
    const candidates = await Transaction.find({
      txHash: { $ne: null },
      hashFabricated: { $ne: true }
    }).select("txHash type description timestamp");

    const fabricated = candidates.filter((t) => !REAL_TX_HASH.test(t.txHash));
    const real = candidates.length - fabricated.length;

    console.log(`Transactions in collection : ${total}`);
    console.log(`  with a hash, unflagged   : ${candidates.length}`);
    console.log(`  -> genuine hashes        : ${real}`);
    console.log(`  -> fabricated, to flag   : ${fabricated.length}\n`);

    if (fabricated.length > 0) {
      console.log("Sample of what will be flagged:");
      fabricated.slice(0, 5).forEach((t) => {
        console.log(`  ${t.txHash}  (${t.txHash.length} chars, ${t.type})`);
      });
      console.log();
    }

    if (DRY_RUN) {
      console.log("🔍 Dry run complete - nothing written.");
    } else if (fabricated.length === 0) {
      console.log("✅ Nothing to do - no unflagged fabricated hashes.");
    } else {
      const result = await Transaction.updateMany(
        { _id: { $in: fabricated.map((t) => t._id) } },
        { $set: { hashFabricated: true } }
      );
      console.log(`✅ Flagged ${result.modifiedCount} transactions as fabricated.`);
    }

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

flagFabricatedHashes();
