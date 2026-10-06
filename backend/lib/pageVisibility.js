// Page visibility: the admin can hide a live page from students until it is
// introduced in class. Hiding is display and access only - no data is touched,
// and the semester archive (routes/archive.js) never consults this.
//
// Stored as one SystemSettings document, key "pageVisibility", value
// { <page>: boolean }. A page missing from the stored value is visible.

const SystemSettings = require("../models/SystemSettings");

// Every toggleable page, id -> label. Adding a page is one line here (plus
// gating its route and nav link on the frontend).
const TOGGLEABLE_PAGES = {
  prediction: "Prediction",
  feed: "The Feed"
};

const SETTING_KEY = "pageVisibility";
const HIDDEN_MESSAGE = "This page isn't available yet";

async function getPageVisibility() {
  const doc = await SystemSettings.findOne({ key: SETTING_KEY }).lean();
  const stored = (doc && doc.value) || {};
  return Object.fromEntries(
    Object.keys(TOGGLEABLE_PAGES).map((page) => [page, stored[page] !== false])
  );
}

async function setPageVisible(page, visible, adminWallet) {
  const visibility = { ...(await getPageVisibility()), [page]: Boolean(visible) };
  await SystemSettings.findOneAndUpdate(
    { key: SETTING_KEY },
    {
      value: visibility,
      description: "Live pages shown to students",
      updatedAt: new Date(),
      updatedBy: adminWallet ? adminWallet.toLowerCase() : undefined
    },
    { upsert: true }
  );
  return visibility;
}

// Middleware for a page's student-facing API. When the page is hidden, only
// the admin gets through. The admin is recognised by the claimed wallet in
// the X-Wallet header - the same claimed-address limit as every student route
// on main (see CLAUDE.md, "Access control").
function requirePageVisible(page) {
  return async (req, res, next) => {
    try {
      const visibility = await getPageVisibility();
      if (visibility[page]) return next();

      const claimed = String(req.get("X-Wallet") || "").toLowerCase();
      const admin = process.env.ADMIN_WALLET?.toLowerCase();
      if (admin && claimed === admin) return next();

      res.status(403).json({ error: HIDDEN_MESSAGE, pageHidden: true, page });
    } catch (err) {
      console.error("Page visibility check error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

module.exports = { TOGGLEABLE_PAGES, getPageVisibility, setPageVisible, requirePageVisible };
