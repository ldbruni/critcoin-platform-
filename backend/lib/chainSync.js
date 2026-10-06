// Chain sync: import on-chain CritCoin transfers into the Transaction ledger.
//
// The chain is the record of transfers; the database is an index of them,
// filled by this import. See ARCHITECTURE.md, "Balance authority".
//
// Transfers are read from the Etherscan API (V2), never from a Sepolia RPC.
// Each transfer is classified:
//   - from the admin wallet to a profile    -> `adminGrant` (balance only)
//   - profile to profile                    -> `project_tip`, credited to the
//     recipient's submission for the active critique project
//   - anything else                         -> skipped, with a reason
// Rows are keyed by their real txHash (unique index), so re-running never
// duplicates anything, and a tip already recorded by the project-page send
// flow is recognized as already imported.

const Transaction = require("../models/Transaction");
const Profile = require("../models/Profiles");
const Project = require("../models/Project");
const SystemSettings = require("../models/SystemSettings");
const { getBalances } = require("./balances");
const { address: CONTRACT_ADDRESS } = require("../sepolia.json");

const ETHERSCAN_API = "https://api.etherscan.io/v2/api";
const SEPOLIA_CHAIN_ID = 11155111;
const PAGE_SIZE = 1000;
// Etherscan returns at most 10,000 rows per query (page * offset).
const MAX_PAGES = 10;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

// SystemSettings keys.
const ACTIVE_PROJECT_KEY = "activeCritiqueProject";
const SYNC_SINCE_KEY = "chainSyncSince";

const isConfigured = () => Boolean(process.env.ETHERSCAN_API_KEY);

// Every CritCoin transfer ever made, oldest first.
async function fetchAllTransfers() {
  if (!isConfigured()) throw new Error("ETHERSCAN_API_KEY is not set on the server");

  const transfers = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(ETHERSCAN_API);
    Object.entries({
      chainid: SEPOLIA_CHAIN_ID,
      module: "account",
      action: "tokentx",
      contractaddress: CONTRACT_ADDRESS,
      page,
      offset: PAGE_SIZE,
      sort: "asc",
      apikey: process.env.ETHERSCAN_API_KEY
    }).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
    const body = await res.json();

    if (body.status !== "1") {
      if (body.message === "No transactions found") break;
      // On error `result` is a message string, never the key.
      throw new Error(`Etherscan: ${body.message} - ${body.result}`);
    }

    for (const t of body.result) {
      transfers.push({
        txHash: t.hash.toLowerCase(),
        from: t.from.toLowerCase(),
        to: t.to.toLowerCase(),
        // Token.sol has no decimals: one on-chain unit is one CritCoin.
        amount: Number(t.value) / 10 ** Number(t.tokenDecimal || 0),
        timestamp: new Date(Number(t.timeStamp) * 1000),
        blockNumber: Number(t.blockNumber)
      });
    }
    if (body.result.length < PAGE_SIZE) return transfers;
  }
  if (transfers.length >= PAGE_SIZE * MAX_PAGES) {
    throw new Error("More than 10,000 CritCoin transfers - Etherscan's query window is exceeded");
  }
  return transfers;
}

async function getSyncSettings() {
  const rows = await SystemSettings.find({ key: { $in: [ACTIVE_PROJECT_KEY, SYNC_SINCE_KEY] } }).lean();
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    activeProject: byKey[ACTIVE_PROJECT_KEY] ?? null,
    since: byKey[SYNC_SINCE_KEY] ?? null
  };
}

async function saveSyncSettings({ activeProject, since }, adminWallet) {
  const values = { [ACTIVE_PROJECT_KEY]: activeProject, [SYNC_SINCE_KEY]: new Date(since).toISOString() };
  await Promise.all(Object.entries(values).map(([key, value]) =>
    SystemSettings.findOneAndUpdate(
      { key },
      { value, updatedAt: new Date(), updatedBy: adminWallet?.toLowerCase() },
      { upsert: true }
    )
  ));
}

// Read-only. Classifies every transfer at or after `since`.
async function planSync({ since, activeProject }, transfers) {
  transfers = transfers || await fetchAllTransfers();
  const admin = process.env.ADMIN_WALLET.toLowerCase();
  const sinceDate = new Date(since);

  const profiles = await Profile.find({ archived: { $ne: true } }).select("wallet name").lean();
  const names = new Map(profiles.map((p) => [p.wallet.toLowerCase(), p.name]));
  const projects = await Project.find({ projectNumber: activeProject, archived: { $ne: true } })
    .select("authorWallet title").lean();
  const projectOf = new Map(projects.map((p) => [p.authorWallet.toLowerCase(), p]));

  const window = transfers.filter((t) => t.timestamp >= sinceDate);
  const known = new Set(await Transaction.distinct("txHash", { txHash: { $in: window.map((t) => t.txHash) } }));

  const toImport = [];
  const skipped = [];
  let alreadyImported = 0;
  const seen = new Set();

  for (const t of window) {
    if (known.has(t.txHash)) { alreadyImported++; continue; }
    const row = { ...t, fromName: names.get(t.from) || null, toName: names.get(t.to) || null };
    const skip = (reason) => skipped.push({ ...row, reason });

    if (seen.has(t.txHash)) { skip("second transfer in the same transaction"); continue; }
    seen.add(t.txHash);

    if (!(t.amount > 0) || !Number.isSafeInteger(t.amount)) {
      skip(`unexpected amount ${t.amount}`);
    } else if (t.from === admin) {
      if (t.to === admin) skip("admin sent to itself");
      else if (!row.toName) skip("recipient has no profile");
      else toImport.push({ ...row, type: "adminGrant" });
    } else if (t.to === admin) {
      skip("transfer to the admin");
    } else if (!row.fromName || !row.toName) {
      skip(!row.fromName && !row.toName ? "neither address has a profile"
        : !row.fromName ? "sender has no profile" : "recipient has no profile");
    } else if (t.from === t.to) {
      skip("sent to self");
    } else if (!activeProject) {
      skip("no active critique project set");
    } else if (!projectOf.has(t.to)) {
      skip(`recipient has no Project ${activeProject} submission`);
    } else {
      const project = projectOf.get(t.to);
      toImport.push({ ...row, type: "investment", projectId: String(project._id), projectTitle: project.title });
    }
  }

  return {
    since: sinceDate.toISOString(),
    activeProject,
    toImport,
    skipped,
    counts: {
      adminGrant: toImport.filter((r) => r.type === "adminGrant").length,
      investment: toImport.filter((r) => r.type === "investment").length,
      skipped: skipped.length,
      alreadyImported
    }
  };
}

// For each active profile: ledger balance vs on-chain balance. Token.sol only
// moves balances through transfer(), which always emits Transfer, so a
// student's chain balance is the sum of their transfer events. Reported only,
// never corrected.
async function balanceCheck(transfers) {
  const admin = process.env.ADMIN_WALLET.toLowerCase();
  const profiles = await Profile.find({ archived: { $ne: true } }).select("wallet name").sort({ name: 1 }).lean();
  const students = profiles.filter((p) => p.wallet.toLowerCase() !== admin);
  const ledger = await getBalances(students.map((p) => p.wallet));

  const chain = new Map();
  for (const t of transfers) {
    chain.set(t.to, (chain.get(t.to) || 0) + t.amount);
    chain.set(t.from, (chain.get(t.from) || 0) - t.amount);
  }

  const rows = students.map((p) => {
    const wallet = p.wallet.toLowerCase();
    const db = ledger.get(wallet).balance;
    const onChain = chain.get(wallet) || 0;
    return { wallet, name: p.name, dbBalance: db, chainBalance: onChain, drift: db - onChain };
  });
  return { rows, mismatches: rows.filter((r) => r.drift !== 0) };
}

// Writes what planSync classifies for import. Safe to run concurrently with
// itself or the project-page send flow: the txHash unique index rejects a
// second copy, and a project total is only incremented after its row inserts.
async function commitSync({ since, activeProject }) {
  const transfers = await fetchAllTransfers();
  const plan = await planSync({ since, activeProject }, transfers);

  let imported = 0;
  let raced = 0;
  for (const r of plan.toImport) {
    const investment = r.type === "investment";
    try {
      await Transaction.create({
        txHash: r.txHash,
        fromWallet: r.from,
        toWallet: r.to,
        amount: r.amount,
        type: investment ? "project_tip" : "adminGrant",
        description: investment
          ? `Tip for project: ${r.projectTitle} (synced from chain)`
          : "Admin grant (synced from chain)",
        relatedId: investment ? r.projectId : undefined,
        blockNumber: r.blockNumber,
        timestamp: r.timestamp
      });
    } catch (err) {
      if (err.code === 11000) { raced++; continue; }
      throw err;
    }
    if (investment) {
      await Project.updateOne({ _id: r.projectId }, { $inc: { totalReceived: r.amount } });
    }
    imported++;
  }

  return {
    since: plan.since,
    activeProject,
    imported,
    counts: { ...plan.counts, alreadyImported: plan.counts.alreadyImported + raced },
    skipped: plan.skipped,
    balances: await balanceCheck(transfers)
  };
}

// Auto-sync: imports new transfers every few minutes, using the active project
// and start time saved by the admin's last manual sync. Does nothing until that
// first manual sync, or when ETHERSCAN_API_KEY is unset.
let lastAutoSync = null;
let running = false;

async function autoSyncOnce() {
  if (running || !isConfigured()) return;
  const settings = await getSyncSettings();
  if (!settings.activeProject || !settings.since) return;

  running = true;
  try {
    const result = await commitSync(settings);
    lastAutoSync = {
      at: new Date().toISOString(),
      imported: result.imported,
      skipped: result.counts.skipped,
      mismatches: result.balances.mismatches.length
    };
    if (result.imported) console.log(`🔗 Chain sync imported ${result.imported} transfer(s)`);
  } catch (err) {
    lastAutoSync = { at: new Date().toISOString(), error: err.message };
    console.error("⚠️ Chain auto-sync failed:", err.message);
  } finally {
    running = false;
  }
}

function startAutoSync() {
  if (!isConfigured()) {
    console.warn("⚠️ ETHERSCAN_API_KEY not set - chain auto-sync disabled");
    return;
  }
  autoSyncOnce();
  setInterval(autoSyncOnce, AUTO_SYNC_INTERVAL_MS).unref();
}

module.exports = {
  SYNC_SINCE_KEY,
  isConfigured,
  fetchAllTransfers,
  getSyncSettings,
  saveSyncSettings,
  planSync,
  commitSync,
  balanceCheck,
  startAutoSync,
  getLastAutoSync: () => lastAutoSync
};
