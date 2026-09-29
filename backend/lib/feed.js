// The Feed: run configuration, quota counting, and the public serializer.

const SystemSettings = require("../models/SystemSettings");

// Defaults for the posting exercise; each is overridable from the admin panel
// through SystemSettings.
const DEFAULTS = {
  feedRunStart: null,           // "YYYY-MM-DD", day 1 of the run
  feedRunDays: 14,
  feedDailyTarget: 10,
  feedTimeZone: "America/New_York" // what "today" means for every student
};

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (e) {
    return false;
  }
}

async function getFeedConfig() {
  const docs = await SystemSettings.find({ key: { $in: Object.keys(DEFAULTS) } }).lean();
  const stored = Object.fromEntries(docs.map((d) => [d.key, d.value]));

  const runStart = /^\d{4}-\d{2}-\d{2}$/.test(stored.feedRunStart || "") ? stored.feedRunStart : null;
  const runDays = parseInt(stored.feedRunDays, 10) > 0 ? parseInt(stored.feedRunDays, 10) : DEFAULTS.feedRunDays;
  const dailyTarget = parseInt(stored.feedDailyTarget, 10) > 0 ? parseInt(stored.feedDailyTarget, 10) : DEFAULTS.feedDailyTarget;
  const timeZone = isValidTimeZone(stored.feedTimeZone) ? stored.feedTimeZone : DEFAULTS.feedTimeZone;

  return { runStart, runDays, dailyTarget, timeZone };
}

// The calendar date ("YYYY-MM-DD") of an instant in the class time zone.
function dayKey(date, timeZone) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86400000);
}

// A poster's counts, from the createdAt of each of their posts.
//   today      - posts on today's date in the class time zone
//   run        - posts dated within the run (all posts if no run is set)
//   dayOfRun   - 1-based, or null outside the run / with no run set
//   runStatus  - "unscheduled" | "upcoming" | "active" | "ended"
function computeQuota(createdAts, config, now = new Date()) {
  const { runStart, runDays, dailyTarget, timeZone } = config;
  const todayKey = dayKey(now, timeZone);
  const keys = createdAts.map((d) => dayKey(new Date(d), timeZone));

  const today = keys.filter((k) => k === todayKey).length;

  if (!runStart) {
    return { today, run: keys.length, dailyTarget, runDays, runStart: null, dayOfRun: null, runStatus: "unscheduled", timeZone };
  }

  const inRun = (k) => {
    const offset = daysBetween(runStart, k);
    return offset >= 0 && offset < runDays;
  };
  const offsetToday = daysBetween(runStart, todayKey);
  const runStatus = offsetToday < 0 ? "upcoming" : offsetToday >= runDays ? "ended" : "active";

  return {
    today,
    run: keys.filter(inRun).length,
    dailyTarget,
    runDays,
    runStart,
    dayOfRun: runStatus === "active" ? offsetToday + 1 : null,
    runStatus,
    timeZone
  };
}

// The ONLY shape in which a feed post leaves the server on a public route.
// It is an allow-list: fields are copied by name, so a field added to the
// model later cannot leak by default. Nothing here identifies the author -
// no wallet, no name, no profile id - and image URLs carry random public ids.
function toPublicPost(post) {
  return {
    _id: String(post._id),
    text: post.text || "",
    images: (post.images || []).map((img) => ({
      url: img.url,
      width: img.width || null,
      height: img.height || null
    })),
    createdAt: post.createdAt
  };
}

module.exports = { DEFAULTS, getFeedConfig, dayKey, computeQuota, toPublicPost, isValidTimeZone };
