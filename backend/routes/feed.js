// backend/routes/feed.js
//
// The Feed: whitelisted students post generated media at volume, and nobody
// sees who posted what except the poster (their own posts) and the instructor
// (admin routes, the database, the semester archive).
//
// The load-bearing rule: authorship is hidden by the API, not by the UI. Every
// public response is built by toPublicPost() in lib/feed.js, which carries no
// author field of any kind. Hiding it only in React would still put it in the
// network tab.
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const { ethers } = require("ethers");
const FeedPost = require("../models/FeedPost");
const { isWhitelisted, normalizeWallet, NOT_WHITELISTED_MESSAGE } = require("../lib/whitelist");
const { uploadImage, isAcceptedImage } = require("../lib/images");
const { getFeedConfig, computeQuota, toPublicPost } = require("../lib/feed");

const MAX_IMAGES = 4;
const MAX_TEXT = 2000;
const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MINE_LIMIT = 500; // a full run at quota is ~140
const MINE_SIGNATURE_TTL = 12 * 60 * 60 * 1000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_IMAGES }, // 10MB each, like projects
  fileFilter: (req, file, cb) => {
    if (isAcceptedImage(file)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  }
});

// Cursor = "<createdAt ms>_<_id>" of the last post on the previous page.
function parseCursor(before) {
  if (!before) return null;
  const [ms, id] = String(before).split("_");
  const createdAt = new Date(Number(ms));
  if (Number.isNaN(createdAt.getTime()) || !mongoose.Types.ObjectId.isValid(id)) return undefined;
  return { createdAt, _id: new mongoose.Types.ObjectId(id) };
}

function cursorFor(post) {
  return `${new Date(post.createdAt).getTime()}_${post._id}`;
}

// GET the public feed, newest first. No author field of any kind.
router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const cursor = parseCursor(req.query.before);
  if (cursor === undefined) return res.status(400).json({ error: "Invalid cursor" });

  const filter = { hidden: { $ne: true } };
  if (cursor) {
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
    ];
  }

  try {
    // The projection is a second guard behind toPublicPost(): authorWallet is
    // never even read out of Mongo for this route.
    const posts = await FeedPost.find(filter, { text: 1, images: 1, createdAt: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const page = posts.slice(0, limit);
    res.json({
      posts: page.map(toPublicPost),
      nextCursor: posts.length > limit ? cursorFor(page[page.length - 1]) : null
    });
  } catch (err) {
    console.error("Feed fetch error:", err);
    res.status(500).json({ error: "Failed to load the feed" });
  }
});

// POST a new feed post. Roster membership is the only requirement (no profile,
// no balance) - see ARCHITECTURE.md, "Whitelist admission". Like every student
// write on main, this trusts the claimed wallet.
router.post("/", (req, res, next) => {
  upload.array("images", MAX_IMAGES)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE" ? "Each image must be 10MB or smaller"
      : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? `At most ${MAX_IMAGES} images per post`
      : err.message;
    res.status(400).json({ error: message });
  });
}, async (req, res) => {
  const wallet = normalizeWallet(req.body.wallet);
  const text = String(req.body.text || "").trim();
  const files = req.files || [];

  if (!wallet) return res.status(400).json({ error: "Wallet required" });
  if (!text && files.length === 0) return res.status(400).json({ error: "A post needs text or an image" });
  if (text.length > MAX_TEXT) return res.status(400).json({ error: `Text is limited to ${MAX_TEXT} characters` });

  try {
    // Checked before any upload, so a rejected wallet costs no Cloudinary storage.
    if (!(await isWhitelisted(wallet))) {
      return res.status(403).json({ error: NOT_WHITELISTED_MESSAGE });
    }

    // Random public ids: the project uploader embeds the wallet in the id, and
    // the id is part of the URL. Here that would publish the author.
    const results = await Promise.all(files.map((file) =>
      uploadImage(file.buffer, {
        folder: "critcoin/feed",
        publicId: `feed_${crypto.randomBytes(12).toString("hex")}`,
        autoOrient: true,
        allowHeic: true
      })
    ));

    const post = await FeedPost.create({
      authorWallet: wallet,
      text,
      images: results.map((r) => ({ url: r.secure_url, width: r.width, height: r.height }))
    });

    res.status(201).json({ post: toPublicPost(post) });
  } catch (err) {
    console.error("Feed post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Verify that the caller controls `wallet`: a personal_sign over a short JSON
// message naming this purpose and wallet, valid for 12 hours so a student
// signs once per session rather than once per request.
//
// Without this, "my posts for wallet X" would be a public lookup, and anyone
// could reconstruct the whole feed's authorship by querying each roster
// wallet. Same verifyMessage pattern as the ADMIN_WALLET check.
function verifyWalletSignature(wallet, message, signature) {
  if (!message || !signature) return "Signature required";
  let data;
  try {
    data = JSON.parse(message);
  } catch (e) {
    return "Invalid message format";
  }
  if (data.purpose !== "critcoin-feed-mine" || normalizeWallet(data.wallet) !== wallet) {
    return "Message does not match this request";
  }
  const age = Date.now() - Number(data.issuedAt);
  if (!Number.isFinite(age) || age > MINE_SIGNATURE_TTL || age < -5 * 60 * 1000) {
    return "Signature expired - sign in again";
  }
  try {
    if (ethers.utils.verifyMessage(message, signature).toLowerCase() !== wallet) {
      return "Signature does not match wallet";
    }
  } catch (e) {
    return "Invalid signature";
  }
  return null;
}

// POST (not GET, to keep the signature out of URLs and logs): the signed-in
// student's own posts, plus their quota. This is the only student-facing
// route that ties posts to a wallet, and it answers only for the signer.
router.post("/mine", async (req, res) => {
  const wallet = normalizeWallet(req.body.wallet);
  if (!wallet) return res.status(400).json({ error: "Wallet required" });

  const problem = verifyWalletSignature(wallet, req.body.message, req.body.signature);
  if (problem) return res.status(401).json({ error: problem });

  try {
    const [posts, config] = await Promise.all([
      FeedPost.find({ authorWallet: wallet }, { text: 1, images: 1, createdAt: 1, hidden: 1 })
        .sort({ createdAt: -1 })
        .limit(MINE_LIMIT)
        .lean(),
      getFeedConfig()
    ]);

    res.json({
      // The poster may see their own hidden posts, marked as such.
      posts: posts.map((p) => ({ ...toPublicPost(p), hidden: Boolean(p.hidden) })),
      quota: computeQuota(posts.map((p) => p.createdAt), config)
    });
  } catch (err) {
    console.error("Feed mine error:", err);
    res.status(500).json({ error: "Failed to load your posts" });
  }
});

module.exports = router;
