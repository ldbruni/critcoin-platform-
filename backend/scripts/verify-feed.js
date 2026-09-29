// backend/scripts/verify-feed.js
//
// End-to-end check of The Feed against an in-memory MongoDB:
//   node scripts/verify-feed.js
//
// Proves the properties the feature exists for - above all, that no public
// response carries authorship - plus whitelist gating, quota, the admin view,
// and semester-archive capture. Cloudinary's network call is stubbed; the real
// sharp pipeline in lib/images.js still runs.
const assert = require("assert");
const express = require("express");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { ethers } = require("ethers");
const { MongoMemoryServer } = require("mongodb-memory-server");

const admin = ethers.Wallet.createRandom();
const alice = ethers.Wallet.createRandom();
const bob = ethers.Wallet.createRandom();
const outsider = ethers.Wallet.createRandom();
process.env.ADMIN_WALLET = admin.address;
process.env.NODE_ENV = "production"; // exercise real signature checks

// Stub Cloudinary's upload stream: record what would be stored, answer like
// Cloudinary does.
const uploads = [];
const cloudinary = require("cloudinary").v2;
cloudinary.uploader.upload_stream = (options, cb) => ({
  async end(buffer) {
    uploads.push({ options, buffer });
    let width = 640, height = 480;
    try { ({ width, height } = await sharp(buffer).metadata()); } catch (e) { /* raw HEIC */ }
    cb(null, {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${options.folder}/${options.public_id}.jpg`,
      width, height
    });
  }
});

const { uploadImage } = require("../lib/images");
const FeedPost = require("../models/FeedPost");
const Whitelist = require("../models/Whitelist");
const Profile = require("../models/Profiles");
const SemesterArchive = require("../models/SemesterArchive");
const { dayKey } = require("../lib/feed");

let passed = 0;
function check(name, fn) {
  return Promise.resolve(fn()).then(() => { passed++; console.log(`  ok  ${name}`); });
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use("/api/feed", require("../routes/feed"));
  app.use("/api/admin", require("../routes/admin"));
  app.use("/api/archive", require("../routes/archive"));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  const allWallets = [alice, bob, outsider].flatMap((w) => [w.address, w.address.toLowerCase()]);
  const leaksAuthor = (json) => {
    const s = JSON.stringify(json);
    return /author/i.test(s) || allWallets.some((w) => s.includes(w)) || s.includes("Alice");
  };

  const adminBody = async () => {
    const message = JSON.stringify({ timestamp: Date.now() });
    return { adminWallet: admin.address, message, signature: await admin.signMessage(message) };
  };
  const adminQuery = async () => {
    const message = JSON.stringify({ timestamp: Date.now() });
    const signature = await admin.signMessage(message);
    return `message=${encodeURIComponent(encodeURIComponent(message))}&signature=${signature}`;
  };
  const postJson = (path, body) => fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const createPost = async (wallet, text, image) => {
    const form = new FormData();
    form.append("wallet", wallet.address);
    form.append("text", text);
    if (image) form.append("images", new Blob([image.buffer], { type: "image/jpeg" }), image.name);
    return fetch(`${base}/api/feed`, { method: "POST", body: form });
  };
  const mineAuth = async (signer, wallet = signer.address) => {
    const message = JSON.stringify({ purpose: "critcoin-feed-mine", wallet: wallet.toLowerCase(), issuedAt: Date.now() });
    return { wallet, message, signature: await signer.signMessage(message) };
  };

  await Whitelist.create([{ wallet: alice.address.toLowerCase(), addedBy: "test" }, { wallet: bob.address.toLowerCase(), addedBy: "test" }]);
  await Profile.create({ wallet: alice.address.toLowerCase(), name: "Alice", birthday: "2000-01-01", starSign: "Capricorn" });

  // A landscape JPEG tagged EXIF orientation 6 (rotate 90) - a phone portrait.
  const phoneJpeg = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#c33" } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();

  console.log("Image pipeline");
  await check("feed uploads apply EXIF orientation", async () => {
    const r = await uploadImage(phoneJpeg, { folder: "t", publicId: "x", autoOrient: true });
    assert.deepStrictEqual([r.width, r.height], [100, 200]);
  });
  await check("project uploads keep their existing behavior (no auto-orient)", async () => {
    const r = await uploadImage(phoneJpeg, { folder: "t", publicId: "x" });
    assert.deepStrictEqual([r.width, r.height], [200, 100]);
  });
  await check("undecodable HEIC is handed to Cloudinary as-is, stored as JPEG", async () => {
    const heic = Buffer.from("....ftypheic not decodable by sharp");
    await uploadImage(heic, { folder: "t", publicId: "x", allowHeic: true });
    const last = uploads[uploads.length - 1];
    assert.strictEqual(last.options.format, "jpg");
    assert.ok(last.buffer.equals(heic));
  });
  uploads.length = 0;

  console.log("Posting");
  await check("whitelisted student can post (with image)", async () => {
    const res = await createPost(alice, "a1", { buffer: phoneJpeg, name: "IMG_0001.jpg" });
    assert.strictEqual(res.status, 201);
    const { post } = await res.json();
    assert.ok(!leaksAuthor(post), "create response must not echo the author");
  });
  for (const t of ["a2", "a3"]) assert.strictEqual((await createPost(alice, t)).status, 201);
  for (const t of ["b1", "b2"]) assert.strictEqual((await createPost(bob, t)).status, 201);

  await check("non-whitelisted wallet is rejected, nothing uploaded", async () => {
    const before = uploads.length;
    const res = await createPost(outsider, "nope", { buffer: phoneJpeg, name: "x.jpg" });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(uploads.length, before);
    assert.strictEqual(await FeedPost.countDocuments({ authorWallet: outsider.address.toLowerCase() }), 0);
  });
  await check("empty post is rejected", async () => {
    assert.strictEqual((await createPost(alice, "   ")).status, 400);
  });

  console.log("Public feed carries no authorship");
  await check("serialized feed JSON has no author field, wallet, or name", async () => {
    const res = await fetch(`${base}/api/feed`);
    const body = await res.json();
    assert.strictEqual(body.posts.length, 5);
    assert.ok(!leaksAuthor(body), JSON.stringify(body));
    for (const p of body.posts) {
      assert.deepStrictEqual(Object.keys(p).sort(), ["_id", "createdAt", "images", "text"]);
    }
  });
  await check("image URL and public id do not contain the wallet", async () => {
    const url = (await (await fetch(`${base}/api/feed`)).json()).posts.find((p) => p.images.length).images[0].url;
    assert.match(url, /\/critcoin\/feed\/feed_[0-9a-f]{24}\.jpg$/);
    assert.ok(!leaksAuthor(url));
  });
  await check("stored post is URL + text only - no image bytes in Mongo", async () => {
    const doc = await FeedPost.findOne({ text: "a1" }).lean();
    const size = Buffer.byteLength(JSON.stringify(doc));
    assert.ok(size < 600, `doc is ${size} bytes`);
    assert.ok(!Object.values(doc).some((v) => Buffer.isBuffer(v)));
  });
  await check("cursor pagination walks every post exactly once", async () => {
    const seen = [];
    let cursor = null;
    do {
      const res = await fetch(`${base}/api/feed?limit=2${cursor ? `&before=${cursor}` : ""}`);
      const body = await res.json();
      seen.push(...body.posts.map((p) => p.text));
      cursor = body.nextCursor;
    } while (cursor);
    assert.deepStrictEqual(seen, ["b2", "b1", "a3", "a2", "a1"]);
  });

  console.log("Own posts and quota");
  await check("own-posts requires a signature", async () => {
    assert.strictEqual((await postJson("/api/feed/mine", { wallet: alice.address })).status, 401);
  });
  await check("one student cannot read another's posts", async () => {
    assert.strictEqual((await postJson("/api/feed/mine", await mineAuth(bob, alice.address))).status, 401);
  });
  await check("student sees exactly their own posts and today's count", async () => {
    const res = await postJson("/api/feed/mine", await mineAuth(alice));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.posts.map((p) => p.text), ["a3", "a2", "a1"]);
    assert.strictEqual(body.quota.today, 3);
    assert.strictEqual(body.quota.runStatus, "unscheduled");
  });
  await check("with a run scheduled 3 days ago it is day 4 of 14", async () => {
    const start = dayKey(new Date(Date.now() - 3 * 86400000), "America/New_York");
    const res = await postJson("/api/admin/feed/settings", {
      runStart: start, runDays: 14, dailyTarget: 10, timeZone: "America/New_York", ...(await adminBody())
    });
    assert.strictEqual(res.status, 200);
    // A post from before the run should not count toward it.
    await FeedPost.create({ authorWallet: alice.address.toLowerCase(), text: "old", createdAt: new Date(Date.now() - 10 * 86400000) });
    const { quota } = await (await postJson("/api/feed/mine", await mineAuth(alice))).json();
    assert.deepStrictEqual([quota.today, quota.run, quota.dayOfRun, quota.runDays, quota.dailyTarget], [3, 3, 4, 14, 10]);
    await FeedPost.deleteOne({ text: "old" });
  });

  console.log("Admin");
  await check("feed settings reject an unknown time zone", async () => {
    const res = await postJson("/api/admin/feed/settings", {
      runStart: null, runDays: 14, dailyTarget: 10, timeZone: "Mars/Olympus", ...(await adminBody())
    });
    assert.strictEqual(res.status, 400);
  });
  await check("admin feed view has full authorship and per-student quota", async () => {
    const res = await fetch(`${base}/api/admin/feed/${admin.address}?${await adminQuery()}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const a1 = body.posts.find((p) => p.text === "a1");
    assert.strictEqual(a1.authorWallet, alice.address.toLowerCase());
    assert.strictEqual(a1.authorName, "Alice");
    const bobQuota = body.quotas.find((q) => q.authorWallet === bob.address.toLowerCase());
    assert.strictEqual(bobQuota.today, 2);
  });
  await check("admin feed view refuses an unsigned request", async () => {
    assert.strictEqual((await fetch(`${base}/api/admin/feed/${admin.address}`)).status, 403);
  });
  await check("hidden post leaves the public feed", async () => {
    const b1 = await FeedPost.findOne({ text: "b1" });
    const res = await postJson("/api/admin/feed/hide", { postId: b1._id, hide: true, ...(await adminBody()) });
    assert.strictEqual(res.status, 200);
    const body = await (await fetch(`${base}/api/feed`)).json();
    assert.deepStrictEqual(body.posts.map((p) => p.text), ["b2", "a3", "a2", "a1"]);
  });

  console.log("Semester archive");
  let archiveId;
  await check("archive captures feed posts with authorship", async () => {
    const res = await postJson("/api/archive/create", { name: "Test Semester", ...(await adminBody()) });
    assert.strictEqual(res.status, 201, await res.clone().text());
    archiveId = (await res.json()).archive._id;
    const doc = await SemesterArchive.findById(archiveId).lean();
    assert.strictEqual(doc.stats.totalFeedPosts, 4);
    assert.strictEqual(doc.feedPosts.length, 4);
    const a1 = doc.feedPosts.find((p) => p.text === "a1");
    assert.strictEqual(a1.authorWallet, alice.address.toLowerCase());
    assert.strictEqual(a1.authorName, "Alice");
    assert.match(a1.images[0].url, /critcoin\/feed\//);
    assert.deepStrictEqual([a1.images[0].width, a1.images[0].height], [100, 200]);
  });
  await check("public archive document omits feed posts entirely", async () => {
    const body = await (await fetch(`${base}/api/archive/${archiveId}`)).json();
    assert.strictEqual(body.feedPosts, undefined);
    assert.strictEqual(body.stats.totalFeedPosts, 4);
  });
  await check("public archived feed is complete and author-free", async () => {
    const body = await (await fetch(`${base}/api/archive/${archiveId}/feed`)).json();
    assert.deepStrictEqual(body.posts.map((p) => p.text), ["b2", "a3", "a2", "a1"]);
    assert.ok(!leaksAuthor(body.posts), JSON.stringify(body.posts));
  });
  await check("admin archived feed keeps authorship", async () => {
    const res = await fetch(`${base}/api/archive/admin/${admin.address}/feed/${archiveId}?${await adminQuery()}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.posts.every((p) => p.authorWallet));
  });
  await check("clear-current removes live feed posts", async () => {
    const res = await postJson("/api/archive/clear-current", { confirmed: true, ...(await adminBody()) });
    assert.strictEqual((await res.json()).deleted.feedPosts, 5);
    assert.strictEqual(await FeedPost.countDocuments(), 0);
  });

  console.log(`\n${passed} checks passed`);
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
