// src/pages/Admin.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";
import { AddressLink, TxLink } from "../components/ChainLink";
import { cloudinaryVariant, THUMB } from "../utils/cloudinary";
import { fetchPageVisibility } from "../utils/pageVisibility";

// How each per-student row reads during a browser deploy.
const DEPLOY_STATUS_LABELS = {
  waiting: "waiting",
  sending: "sending…",
  sent: "sent",
  rejected: "rejected in MetaMask",
  failed: "failed"
};

const DEPLOY_STATUS_COLORS = {
  waiting: "var(--text-muted)",
  sending: "var(--accent-orange)",
  sent: "var(--status-positive)",
  rejected: "var(--status-warning)",
  failed: "var(--status-negative)"
};

const DEFAULT_DEPLOY_AMOUNT = 10000;
const SEPOLIA_CHAIN_ID = 11155111;
// Token.sol has no decimals: one on-chain unit is one CritCoin. The Etherscan
// import divides by 10^tokenDecimal, so sending parseUnits(amount, 0) shows up
// on the site as exactly `amount`.
const TOKEN_DECIMALS = 0;

// Gas (Sepolia ETH) for students. A CritCoin transfer costs ~50k gas; at a busy
// 20 gwei that's ~0.001 ETH, so 0.005 ETH covers about five transfers and the
// 0.01 ETH top-up target about ten. Faucet ETH is scarce, so keep these small.
const DEFAULT_GAS_LOW = "0.005";
const DEFAULT_GAS_TARGET = "0.01";
const ETH_TRANSFER_GAS = 21000;
const parseEthOrNull = (value) => {
  try {
    const wei = ethers.utils.parseEther(String(value).trim());
    return wei.gt(0) ? wei : null;
  } catch {
    return null;
  }
};
const formatEth = (wei) => Number(ethers.utils.formatEther(wei)).toFixed(4);

// MetaMask rejections arrive as EIP-1193 code 4001, or ACTION_REJECTED from
// newer ethers v5 releases.
const isUserRejection = (err) =>
  err?.code === 4001 || err?.code === "ACTION_REJECTED" || err?.error?.code === 4001;

// wallet -> txHash for every transfer sent in this page session.
const sentWallets = (status) =>
  new Map(Object.keys(status).filter((w) => status[w].state === "sent").map((w) => [w, status[w].hash]));

const API = {
  admin: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/admin` : "http://localhost:3001/api/admin",
  profiles: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/profiles` : "http://localhost:3001/api/profiles",
  archive: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/archive` : "http://localhost:3001/api/archive"
};

// Replace with your actual admin wallet address
const ADMIN_WALLET = process.env.REACT_APP_ADMIN_WALLET?.toLowerCase() || "0xc69c361d300aeaad0aee95bd1c753e62298f92e9";

export default function Admin() {
  const [wallet, setWallet] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [bounties, setBounties] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState({});
  const [whitelist, setWhitelist] = useState([]);
  const [pageVisibility, setPageVisibility] = useState(null); // { pages, visibility }
  const [loading, setLoading] = useState(false);
  
  // Deploy CritCoin: profile checklist + browser-side MetaMask transfers
  const [deployRoster, setDeployRoster] = useState(null);
  const [deploySelected, setDeploySelected] = useState({}); // wallet -> checked
  const [deployAmount, setDeployAmount] = useState(String(DEFAULT_DEPLOY_AMOUNT));
  const [deployStatus, setDeployStatus] = useState({}); // wallet -> { state, hash, error }
  const [deployRunning, setDeployRunning] = useState(false);
  const [deployMessage, setDeployMessage] = useState(null); // { tone, text }
  // Send gas: Sepolia ETH top-ups from the admin's MetaMask. Never touches the ledger.
  const [gasBalances, setGasBalances] = useState({}); // wallet -> BigNumber wei
  const [gasLow, setGasLow] = useState(DEFAULT_GAS_LOW);
  const [gasTarget, setGasTarget] = useState(DEFAULT_GAS_TARGET);
  const [gasSelected, setGasSelected] = useState({}); // wallet -> checked
  const [gasStatus, setGasStatus] = useState({}); // wallet -> { state, hash, error }
  const [gasRunning, setGasRunning] = useState(false);
  const [gasMessage, setGasMessage] = useState(null); // { tone, text }
  const [reconcile, setReconcile] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  // Sync from Chain: import on-chain transfers; manual ledger adjustment
  const [chainSyncStatus, setChainSyncStatus] = useState(null);
  const [chainSyncForm, setChainSyncForm] = useState({ project: 1, since: "" });
  const [chainSyncPreview, setChainSyncPreview] = useState(null);
  const [chainSyncResult, setChainSyncResult] = useState(null);
  const [chainSyncLoading, setChainSyncLoading] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ wallet: "", amount: "", note: "" });
  
  // Bounty form
  const [bountyForm, setBountyForm] = useState({ title: "", description: "", reward: "" });
  const [editingBounty, setEditingBounty] = useState(null);
  
  // The Feed: posts with authorship, per-student quota, run settings
  const [feedAdmin, setFeedAdmin] = useState(null);
  const [feedForm, setFeedForm] = useState({ runStart: "", runDays: 14, dailyTarget: 10, timeZone: "America/New_York" });

  // Whitelist form
  const [whitelistForm, setWhitelistForm] = useState({ wallet: "", label: "", notes: "" });

  // Semester Archive state
  const [semesterArchives, setSemesterArchives] = useState([]);
  const [archiveForm, setArchiveForm] = useState({ name: "", description: "" });
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingArchive, setEditingArchive] = useState(null);
  const [archivePreview, setArchivePreview] = useState(null);

  useEffect(() => {
    if (window.ethereum) connectWallet();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboard();
      if (activeTab === "profiles") fetchProfiles();
      if (activeTab === "posts") fetchPosts();
      if (activeTab === "feed") fetchFeedAdmin();
      if (activeTab === "bounties") fetchBounties();
      if (activeTab === "projects") fetchProjects();
      if (activeTab === "whitelist") fetchWhitelist();
      if (activeTab === "predictions") fetchSettings();
      if (activeTab === "pages") fetchPageVisibilityAdmin();
      if (activeTab === "semester") fetchSemesterArchives();
      if (activeTab === "deploy") fetchDeployRoster().then((students) => students && fetchGasBalances(students));
      if (activeTab === "reconcile") fetchReconcile();
      if (activeTab === "chainsync") fetchChainSyncStatus();
    }
  }, [isAdmin, activeTab]);

  const connectWallet = async () => {
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      setWallet(addr);
      setProvider(provider);
      setSigner(signer);
      setIsAdmin(addr.toLowerCase() === ADMIN_WALLET);
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  // Helper function to create signed admin requests
  const createSignedAdminRequest = async (action, additionalData = {}) => {
    if (!signer || !wallet) {
      throw new Error('Wallet not connected');
    }

    const messageData = {
      timestamp: Date.now(),
      action: action,
      wallet: wallet.toLowerCase(),
      ...additionalData
    };

    const message = JSON.stringify(messageData);
    const signature = await signer.signMessage(message);
    
    return { message, signature };
  };

  // Helper function for signed GET requests
  const fetchWithSignature = async (url, action) => {
    try {
      const { message, signature } = await createSignedAdminRequest(action);
      const signedUrl = `${url}?message=${encodeURIComponent(message)}&signature=${signature}`;
      return await fetch(signedUrl);
    } catch (err) {
      console.error('Signed request error:', err);
      // Fallback for development mode
      if (process.env.NODE_ENV === 'development') {
        console.warn('Falling back to unsigned request in development mode');
        return await fetch(url);
      }
      throw err;
    }
  };

  // Helper function for signed POST requests
  const postWithSignature = async (url, action, data = {}) => {
    try {
      const { message, signature } = await createSignedAdminRequest(action, data);
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          adminWallet: wallet,
          message,
          signature
        })
      });
    } catch (err) {
      console.error('Signed POST request error:', err);
      // Fallback for development mode
      if (process.env.NODE_ENV === 'development') {
        console.warn('Falling back to unsigned POST request in development mode');
        return await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            adminWallet: wallet
          })
        });
      }
      throw err;
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetchWithSignature(`${API.admin}/dashboard/${wallet}`, 'admin_get_dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch dashboard' }));
        console.error("Dashboard fetch error:", error);
        alert(`Dashboard error: ${error.error}`);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      alert('Failed to connect to dashboard. Please check your wallet connection.');
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/profiles/${wallet}`, 'admin_get_profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch profiles' }));
        console.error("Profiles fetch error:", error);
        alert(`Profiles error: ${error.error}`);
      }
    } catch (err) {
      console.error("Profiles fetch error:", err);
      alert('Failed to fetch profiles. Please check your wallet connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/posts/${wallet}`, 'admin_get_posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch posts' }));
        console.error("Posts fetch error:", error);
        alert(`Posts error: ${error.error}`);
      }
    } catch (err) {
      console.error("Posts fetch error:", err);
      alert('Failed to fetch posts. Please check your wallet connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedAdmin = async () => {
    setLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/feed/${wallet}`, 'admin_get_feed');
      if (res.ok) {
        const data = await res.json();
        setFeedAdmin(data);
        setFeedForm({
          runStart: data.config.runStart || "",
          runDays: data.config.runDays,
          dailyTarget: data.config.dailyTarget,
          timeZone: data.config.timeZone
        });
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch feed' }));
        alert(`Feed error: ${error.error}`);
      }
    } catch (err) {
      console.error("Feed fetch error:", err);
      alert('Failed to fetch feed. Please check your wallet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeedSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await postWithSignature(`${API.admin}/feed/settings`, 'admin_post_feed_settings', feedForm);
      if (res.ok) {
        fetchFeedAdmin();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Feed settings error:", err);
      alert("Error saving feed settings. Please check your wallet connection.");
    }
  };

  const handleHideFeedPost = async (postId, hide) => {
    try {
      const res = await postWithSignature(`${API.admin}/feed/hide`, 'admin_post_feed_hide', { postId, hide });
      if (res.ok) {
        fetchFeedAdmin();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Hide feed post error:", err);
      alert("Error hiding feed post. Please check your wallet connection.");
    }
  };

  const fetchBounties = async () => {
    setLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/bounties/${wallet}`, 'admin_get_bounties');
      if (res.ok) {
        const data = await res.json();
        setBounties(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch bounties' }));
        console.error("Bounties fetch error:", error);
        alert(`Bounties error: ${error.error}`);
      }
    } catch (err) {
      console.error("Bounties fetch error:", err);
      alert('Failed to fetch bounties. Please check your wallet connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/projects/${wallet}`, 'admin_get_projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch projects' }));
        console.error("Projects fetch error:", error);
        alert(`Projects error: ${error.error}`);
      }
    } catch (err) {
      console.error("Projects fetch error:", err);
      alert('Failed to fetch projects. Please check your wallet connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      console.log("Fetching settings for wallet:", wallet);
      const res = await fetchWithSignature(`${API.admin}/settings/${wallet}`, 'admin_get_settings');
      if (res.ok) {
        const data = await res.json();
        console.log("Settings fetched:", data);
        setSettings(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch settings' }));
        console.error("Settings fetch error:", error);
        alert(`Settings error: ${error.error}`);
      }
    } catch (err) {
      console.error("Settings fetch error:", err);
      alert('Failed to fetch settings. Please check your wallet connection.');
    }
  };

  const fetchWhitelist = async () => {
    setLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/whitelist/${wallet}`, 'admin_get_whitelist');
      if (res.ok) {
        const data = await res.json();
        setWhitelist(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch whitelist' }));
        console.error("Whitelist fetch error:", error);
        alert(`Whitelist error: ${error.error}`);
      }
    } catch (err) {
      console.error("Whitelist fetch error:", err);
      alert('Failed to fetch whitelist. Please check your wallet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveProfile = async (profileWallet, archive) => {
    try {
      const res = await postWithSignature(`${API.admin}/profiles/archive`, 'admin_post_profiles_archive', {
        wallet: profileWallet,
        archive
      });

      if (res.ok) {
        alert(`Profile ${archive ? 'archived' : 'unarchived'} successfully`);
        fetchProfiles();
        fetchDashboard();
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to archive profile' }));
        alert("Error: " + error.error);
      }
    } catch (err) {
      console.error("Archive profile error:", err);
      alert("Error archiving profile. Please check your wallet connection.");
    }
  };

  const handleHidePost = async (postId, hide) => {
    try {
      const res = await postWithSignature(`${API.admin}/posts/hide`, 'admin_post_posts_hide', {
        postId,
        hide
      });

      if (res.ok) {
        alert(`Post ${hide ? 'hidden' : 'unhidden'} successfully`);
        fetchPosts();
        fetchDashboard();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Hide post error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Hide post error:", err);
      alert("Error hiding post. Please check your wallet connection.");
    }
  };

  const handleArchiveProject = async (projectId, archive) => {
    try {
      const res = await postWithSignature(`${API.admin}/projects/archive`, 'admin_post_projects_archive', {
        projectId,
        archive
      });

      if (res.ok) {
        alert(`Project ${archive ? 'archived' : 'unarchived'} successfully`);
        fetchProjects();
        fetchDashboard();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Archive project error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Archive project error:", err);
      alert("Error archiving project. Please check your wallet connection.");
    }
  };

  const handleBountySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const action = editingBounty ? 'admin_post_bounties_update' : 'admin_post_bounties_create';
      const endpoint = editingBounty 
        ? `${API.admin}/bounties/update`
        : `${API.admin}/bounties`;
      
      const payload = {
        title: bountyForm.title,
        description: bountyForm.description,
        reward: Number(bountyForm.reward)
      };

      if (editingBounty) {
        payload.bountyId = editingBounty._id;
      }

      const res = await postWithSignature(endpoint, action, payload);

      if (res.ok) {
        alert(`Bounty ${editingBounty ? 'updated' : 'created'} successfully`);
        setBountyForm({ title: "", description: "", reward: "" });
        setEditingBounty(null);
        fetchBounties();
        fetchDashboard();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Bounty submit error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Bounty submit error:", err);
      alert("Error with bounty. Please check your wallet connection.");
    }
  };

  const handleCrossOutBounty = async (bountyId, crossOut) => {
    try {
      const res = await postWithSignature(`${API.admin}/bounties/cross-out`, 'admin_post_bounties_cross_out', {
        bountyId,
        crossOut
      });

      if (res.ok) {
        alert(`Bounty ${crossOut ? 'crossed out' : 'restored'} successfully`);
        fetchBounties();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Cross out bounty error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Cross out bounty error:", err);
      alert("Error crossing out bounty. Please check your wallet connection.");
    }
  };

  const handleDeleteBounty = async (bountyId, bountyTitle) => {
    if (!window.confirm(`Are you sure you want to permanently delete the bounty "${bountyTitle}"?\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const res = await postWithSignature(`${API.admin}/bounties/delete`, 'admin_post_bounties_delete', {
        bountyId
      });

      if (res.ok) {
        alert('Bounty deleted successfully');
        fetchBounties();
        fetchDashboard();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Delete bounty error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Delete bounty error:", err);
      alert("Error deleting bounty. Please check your wallet connection.");
    }
  };

  const handleTogglePrediction = async (projectNum, currentlyEnabled) => {
    try {
      const res = await postWithSignature(`${API.admin}/settings`, 'admin_post_settings', {
        key: `predictionEnabled${projectNum}`,
        value: !currentlyEnabled
      });
      if (res.ok) {
        alert(`Project ${projectNum} predictions ${!currentlyEnabled ? 'opened' : 'closed'} successfully`);
        fetchSettings();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Toggle prediction error:", err);
      alert("Error toggling predictions. Please check your wallet connection.");
    }
  };

  const fetchPageVisibilityAdmin = async () => {
    try {
      setPageVisibility(await fetchPageVisibility());
    } catch (err) {
      console.error("Page visibility fetch error:", err);
      alert("Failed to fetch page visibility.");
    }
  };

  const handleTogglePageVisibility = async (page, currentlyVisible) => {
    try {
      const res = await postWithSignature(`${API.admin}/page-visibility`, 'admin_post_page-visibility', {
        page,
        visible: !currentlyVisible
      });
      if (res.ok) {
        const data = await res.json();
        setPageVisibility(prev => ({ ...prev, visibility: data.visibility }));
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Toggle page visibility error:", err);
      alert("Error changing page visibility. Please check your wallet connection.");
    }
  };

  const handleAddToWhitelist = async (e) => {
    e.preventDefault();
    
    if (!whitelistForm.wallet) {
      alert("Wallet address is required");
      return;
    }

    try {
      const res = await postWithSignature(`${API.admin}/whitelist/add`, 'admin_post_whitelist_add', {
        wallet: whitelistForm.wallet,
        label: whitelistForm.label,
        notes: whitelistForm.notes
      });

      if (res.ok) {
        alert("Wallet added to whitelist successfully");
        setWhitelistForm({ wallet: "", label: "", notes: "" });
        fetchWhitelist();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Add to whitelist error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Add to whitelist error:", err);
      alert("Error adding wallet to whitelist. Please check your wallet connection.");
    }
  };

  const handleRemoveFromWhitelist = async (walletToRemove) => {
    if (!window.confirm(`Are you sure you want to remove ${walletToRemove} from the whitelist?`)) {
      return;
    }

    try {
      const res = await postWithSignature(`${API.admin}/whitelist/remove`, 'admin_post_whitelist_remove', {
        wallet: walletToRemove
      });

      if (res.ok) {
        alert("Wallet removed from whitelist successfully");
        fetchWhitelist();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Remove from whitelist error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Remove from whitelist error:", err);
      alert("Error removing wallet from whitelist. Please check your wallet connection.");
    }
  };

  // Deploy CritCoin
  //
  // Runs entirely in the browser: MetaMask preflights and signs every transfer,
  // the same way the admin's manual sends work. The backend only supplies the
  // checklist (active profiles + adminGrants already imported) and, afterwards,
  // runs the Etherscan sync so the grants appear right away. txHash dedup in
  // the import means re-syncing never double-counts.

  // Load the checklist. Default: checked if no adminGrant yet. Students sent to
  // in this session stay unchecked even before Etherscan has indexed them.
  const fetchDeployRoster = async (alreadySent = sentWallets(deployStatus)) => {
    try {
      const res = await fetchWithSignature(`${API.admin}/deploy/roster/${wallet}`, 'admin_get_deploy_roster');
      const data = await res.json();
      if (!res.ok) {
        setDeployMessage({ tone: "negative", text: data.error || "Failed to load the deploy roster" });
        return null;
      }
      setDeployRoster(data.students);
      setDeploySelected(Object.fromEntries(data.students.map((s) => [
        s.wallet,
        !s.isAdmin && s.grantCount === 0 && !alreadySent.has(s.wallet)
      ])));
      return data.students;
    } catch (err) {
      console.error("Deploy roster fetch error:", err);
      setDeployMessage({ tone: "negative", text: "Failed to load the deploy roster." });
      return null;
    }
  };

  const setDeployRow = (address, row) =>
    setDeployStatus((prev) => ({ ...prev, [address]: row }));

  // Import the admin's sends now instead of waiting for the 5-minute auto-sync,
  // then report any send from this session whose hash isn't in the ledger yet.
  const syncDeployGrants = async (sent = sentWallets(deployStatus)) => {
    setDeployMessage({ tone: "muted", text: "Importing the transfers from Etherscan…" });
    try {
      const res = await postWithSignature(`${API.admin}/chain-sync/run`, 'admin_post_chain_sync_run');
      const data = await res.json();
      const students = await fetchDeployRoster(sent);
      if (!res.ok) {
        setDeployMessage({ tone: "negative", text: `Transfers sent, but the sync failed: ${data.error}. The auto-sync will retry within 5 minutes.` });
        return;
      }
      const imported = new Set((students || []).flatMap((s) => s.grantHashes));
      const missing = [...sent.values()].filter((hash) => !imported.has(hash.toLowerCase()));
      setDeployMessage(missing.length === 0
        ? { tone: "positive", text: `Synced: ${data.imported} transfer(s) imported. Grants are on the site.` }
        : { tone: "warning", text: `Synced, but Etherscan hasn't indexed ${missing.length} transfer(s) yet. Click "Sync now" in a minute, or the auto-sync will pick them up within 5 minutes.` });
    } catch (err) {
      console.error("Deploy sync error:", err);
      setDeployMessage({ tone: "negative", text: "Transfers sent, but the sync request failed. The auto-sync will pick them up within 5 minutes." });
    }
  };

  const runDeploy = async () => {
    const amount = Number(deployAmount);
    const recipients = (deployRoster || []).filter((s) => deploySelected[s.wallet] && !s.isAdmin);
    const stop = (text) => setDeployMessage({ tone: "negative", text });

    if (!Number.isSafeInteger(amount) || amount <= 0) return stop("Amount must be a positive whole number.");
    if (recipients.length === 0) return stop("No students are checked.");
    if (!window.ethereum) return stop("MetaMask not found.");

    const total = amount * recipients.length;
    if (!window.confirm(`Deploy ${amount.toLocaleString()} to ${recipients.length} student(s) = ${total.toLocaleString()} CritCoin total?`)) return;

    setDeployRunning(true);
    try {
      // --- Preflight, all through MetaMask's provider. Nothing is sent on failure.
      setDeployMessage({ tone: "muted", text: "Preflight: checking wallet, network and balance…" });
      // "any" reads the current network even if MetaMask switched since connect.
      const web3 = new ethers.providers.Web3Provider(window.ethereum, "any");
      const metaSigner = web3.getSigner();
      const from = (await metaSigner.getAddress()).toLowerCase();
      if (from !== ADMIN_WALLET) {
        return stop(`MetaMask is connected as ${from}, not the admin wallet ${ADMIN_WALLET}. Switch accounts in MetaMask. Nothing was sent.`);
      }
      const { chainId } = await web3.getNetwork();
      if (chainId !== SEPOLIA_CHAIN_ID) {
        return stop(`MetaMask is on chain ${chainId}, not Sepolia (${SEPOLIA_CHAIN_ID}). Switch networks in MetaMask. Nothing was sent.`);
      }
      const contract = new ethers.Contract(deployed.address, deployed.abi, metaSigner);
      const units = ethers.utils.parseUnits(String(amount), TOKEN_DECIMALS);
      const held = await contract.balanceOf(from);
      if (held.lt(units.mul(recipients.length))) {
        return stop(`The admin wallet holds ${ethers.utils.formatUnits(held, TOKEN_DECIMALS)} CritCoin; this run needs ${total.toLocaleString()}. Nothing was sent.`);
      }

      // --- Transfers, strictly one at a time: concurrent sends from one wallet
      // collide on the nonce. A rejection or failure is marked and skipped.
      setDeployStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(recipients.map((s) => [s.wallet, { state: "waiting" }]))
      }));
      const sent = sentWallets(deployStatus);

      for (const [i, s] of recipients.entries()) {
        setDeployMessage({ tone: "muted", text: `Sending ${i + 1} of ${recipients.length}: ${s.name}. Confirm in MetaMask.` });
        setDeployRow(s.wallet, { state: "sending" });
        let tx = null;
        try {
          tx = await contract.transfer(s.wallet, units);
          setDeployRow(s.wallet, { state: "sending", hash: tx.hash });
          await tx.wait();
          setDeployRow(s.wallet, { state: "sent", hash: tx.hash });
          sent.set(s.wallet, tx.hash);
        } catch (err) {
          if (err.code === "TRANSACTION_REPLACED" && !err.cancelled) {
            // Sped up in MetaMask: the replacement carries the transfer.
            setDeployRow(s.wallet, { state: "sent", hash: err.replacement.hash });
            sent.set(s.wallet, err.replacement.hash);
          } else if (isUserRejection(err)) {
            setDeployRow(s.wallet, { state: "rejected" });
          } else {
            console.error(`Deploy transfer to ${s.name} failed:`, err);
            setDeployRow(s.wallet, {
              state: "failed",
              hash: tx?.hash,
              error: String(err.reason || err.message || "Unknown error").slice(0, 160)
            });
          }
        }
      }

      if (recipients.some((s) => sent.has(s.wallet))) {
        await syncDeployGrants(sent);
      } else {
        setDeployMessage({ tone: "warning", text: "Run finished. No transfers went through." });
      }
    } catch (err) {
      console.error("Deploy error:", err);
      stop(`Deploy stopped: ${err.message}`);
    } finally {
      setDeployRunning(false);
    }
  };

  // Send gas
  //
  // Sepolia ETH, not CritCoin: balances are read and sends are signed through
  // MetaMask, nothing touches the backend, and the chain sync (tokentx only)
  // never sees these transfers, so they never enter the Transaction ledger.

  // Read every student's ETH balance via MetaMask's provider. Students below the
  // low threshold come back checked for "Send gas".
  const fetchGasBalances = async (students = deployRoster || []) => {
    if (!window.ethereum) {
      setGasMessage({ tone: "negative", text: "MetaMask not found; can't read ETH balances." });
      return;
    }
    try {
      const web3 = new ethers.providers.Web3Provider(window.ethereum, "any");
      const { chainId } = await web3.getNetwork();
      if (chainId !== SEPOLIA_CHAIN_ID) {
        setGasMessage({ tone: "negative", text: `MetaMask is on chain ${chainId}, not Sepolia. Switch networks and click "Refresh ETH".` });
        return;
      }
      const balances = await Promise.all(students.map((s) => web3.getBalance(s.wallet)));
      const byWallet = Object.fromEntries(students.map((s, i) => [s.wallet, balances[i]]));
      const low = parseEthOrNull(gasLow);
      setGasBalances(byWallet);
      setGasSelected(Object.fromEntries(students.map((s) => [
        s.wallet,
        !s.isAdmin && Boolean(low) && byWallet[s.wallet].lt(low)
      ])));
      return byWallet;
    } catch (err) {
      console.error("ETH balance read error:", err);
      setGasMessage({ tone: "negative", text: `Couldn't read ETH balances: ${err.message}` });
    }
  };

  const setGasRow = (address, row) =>
    setGasStatus((prev) => ({ ...prev, [address]: row }));

  // Top up each checked student to the target; anyone at or above it gets nothing.
  const gasTopUps = () => {
    const target = parseEthOrNull(gasTarget);
    if (!target) return [];
    return (deployRoster || [])
      .filter((s) => gasSelected[s.wallet] && !s.isAdmin && gasBalances[s.wallet])
      .map((s) => ({ ...s, topUp: target.sub(gasBalances[s.wallet]) }))
      .filter((s) => s.topUp.gt(0));
  };

  const runSendGas = async () => {
    const recipients = gasTopUps();
    const stop = (text) => setGasMessage({ tone: "negative", text });

    if (!parseEthOrNull(gasTarget)) return stop("Target must be a positive ETH amount.");
    if (recipients.length === 0) return stop("No checked student is below the target.");
    if (!window.ethereum) return stop("MetaMask not found.");

    const total = recipients.reduce((sum, s) => sum.add(s.topUp), ethers.BigNumber.from(0));
    if (!window.confirm(`Send ${ethers.utils.formatEther(total)} ETH total to ${recipients.length} student(s)?`)) return;

    setGasRunning(true);
    try {
      // --- Preflight through MetaMask. Nothing is sent on failure.
      setGasMessage({ tone: "muted", text: "Preflight: checking wallet, network and ETH balance…" });
      const web3 = new ethers.providers.Web3Provider(window.ethereum, "any");
      const metaSigner = web3.getSigner();
      const from = (await metaSigner.getAddress()).toLowerCase();
      if (from !== ADMIN_WALLET) {
        return stop(`MetaMask is connected as ${from}, not the admin wallet ${ADMIN_WALLET}. Switch accounts in MetaMask. Nothing was sent.`);
      }
      const { chainId } = await web3.getNetwork();
      if (chainId !== SEPOLIA_CHAIN_ID) {
        return stop(`MetaMask is on chain ${chainId}, not Sepolia (${SEPOLIA_CHAIN_ID}). Switch networks in MetaMask. Nothing was sent.`);
      }
      const fees = await web3.getFeeData();
      const feePerGas = fees.maxFeePerGas || fees.gasPrice;
      const gasCost = feePerGas.mul(ETH_TRANSFER_GAS).mul(recipients.length);
      const held = await web3.getBalance(from);
      if (held.lt(total.add(gasCost))) {
        return stop(`The admin wallet holds ${formatEth(held)} ETH; this run needs ${formatEth(total)} ETH plus about ${formatEth(gasCost)} ETH in gas. Nothing was sent.`);
      }

      // --- Sends, one at a time. A rejection or failure is marked and skipped.
      setGasStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(recipients.map((s) => [s.wallet, { state: "waiting" }]))
      }));
      let sentCount = 0;
      for (const [i, s] of recipients.entries()) {
        setGasMessage({ tone: "muted", text: `Sending gas ${i + 1} of ${recipients.length}: ${formatEth(s.topUp)} ETH to ${s.name}. Confirm in MetaMask.` });
        setGasRow(s.wallet, { state: "sending" });
        let tx = null;
        try {
          tx = await metaSigner.sendTransaction({ to: s.wallet, value: s.topUp });
          setGasRow(s.wallet, { state: "sending", hash: tx.hash });
          await tx.wait();
          setGasRow(s.wallet, { state: "sent", hash: tx.hash });
          sentCount++;
        } catch (err) {
          if (err.code === "TRANSACTION_REPLACED" && !err.cancelled) {
            setGasRow(s.wallet, { state: "sent", hash: err.replacement.hash });
            sentCount++;
          } else if (isUserRejection(err)) {
            setGasRow(s.wallet, { state: "rejected" });
          } else {
            console.error(`Gas send to ${s.name} failed:`, err);
            setGasRow(s.wallet, {
              state: "failed",
              hash: tx?.hash,
              error: String(err.reason || err.message || "Unknown error").slice(0, 160)
            });
          }
        }
      }

      setGasMessage(sentCount > 0
        ? { tone: "positive", text: `Gas run finished: ${sentCount} of ${recipients.length} send(s) went through.` }
        : { tone: "warning", text: "Gas run finished. No sends went through." });
    } catch (err) {
      console.error("Send gas error:", err);
      stop(`Send gas stopped: ${err.message}`);
    } finally {
      setGasRunning(false);
      // Re-read every balance, not just the recipients; also re-checks who's low.
      await fetchGasBalances();
    }
  };

  // Reconciliation report: database vs chain. Read-only diagnostic.
  const fetchReconcile = async () => {
    setReconcileLoading(true);
    try {
      const res = await fetchWithSignature(`${API.admin}/reconcile/${wallet}`, 'admin_get_reconcile');
      if (res.ok) {
        setReconcile(await res.json());
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch reconciliation' }));
        alert(`Reconciliation error: ${error.error}`);
      }
    } catch (err) {
      console.error("Reconcile fetch error:", err);
      alert("Failed to fetch reconciliation report.");
    } finally {
      setReconcileLoading(false);
    }
  };

  // Sync from Chain Functions
  // <input type="datetime-local"> value for a Date, in local time.
  const toLocalInput = (date) => {
    const d = new Date(date);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const fetchChainSyncStatus = async () => {
    try {
      const res = await fetchWithSignature(`${API.admin}/chain-sync/status/${wallet}`, 'admin_get_chain_sync_status');
      if (!res.ok) return;
      const status = await res.json();
      setChainSyncStatus(status);
      setChainSyncForm({
        project: status.settings.activeProject || 1,
        since: toLocalInput(status.settings.since || Date.now() - 24 * 60 * 60 * 1000)
      });
    } catch (err) {
      console.error("Chain sync status error:", err);
    }
  };

  const previewChainSync = async () => {
    setChainSyncLoading(true);
    setChainSyncResult(null);
    try {
      const { message, signature } = await createSignedAdminRequest('admin_get_chain_sync_preview');
      const params = new URLSearchParams({
        since: new Date(chainSyncForm.since).toISOString(),
        project: chainSyncForm.project,
        message,
        signature
      });
      const data = await (await fetch(`${API.admin}/chain-sync/preview/${wallet}?${params}`)).json();
      if (data.error) alert(data.error);
      else setChainSyncPreview(data);
    } catch (err) {
      console.error("Chain sync preview error:", err);
      alert("Failed to preview chain sync.");
    } finally {
      setChainSyncLoading(false);
    }
  };

  const commitChainSync = async () => {
    setChainSyncLoading(true);
    try {
      const res = await postWithSignature(`${API.admin}/chain-sync/commit`, 'admin_post_chain_sync_commit', {
        since: chainSyncPreview.since,
        project: chainSyncPreview.activeProject
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Chain sync failed");
        return;
      }
      setChainSyncResult(data);
      setChainSyncPreview(null);
      fetchChainSyncStatus();
    } catch (err) {
      console.error("Chain sync commit error:", err);
      alert("Failed to run chain sync.");
    } finally {
      setChainSyncLoading(false);
    }
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    const amount = Number(adjustForm.amount);
    if (!window.confirm(`${amount > 0 ? "Credit" : "Debit"} ${Math.abs(amount)} CritCoin ${amount > 0 ? "to" : "from"} ${adjustForm.wallet}?`)) return;
    try {
      const res = await postWithSignature(`${API.admin}/ledger/adjust`, 'admin_post_ledger_adjust', {
        wallet: adjustForm.wallet.trim(),
        amount,
        note: adjustForm.note
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Adjustment failed");
        return;
      }
      alert(`Adjustment recorded. New balance: ${data.balance} CritCoin`);
      setAdjustForm({ wallet: "", amount: "", note: "" });
    } catch (err) {
      console.error("Adjustment error:", err);
      alert("Failed to record adjustment.");
    }
  };

  // Semester Archive Functions
  const fetchSemesterArchives = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(API.archive);
      if (res.ok) {
        const data = await res.json();
        setSemesterArchives(data);
      }
    } catch (err) {
      console.error("Semester archives fetch error:", err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const fetchArchivePreview = async () => {
    try {
      const res = await fetch(`${API.archive}/preview`);
      if (res.ok) {
        const data = await res.json();
        setArchivePreview(data);
      }
    } catch (err) {
      console.error("Archive preview fetch error:", err);
    }
  };

  const handleCreateArchive = async (e) => {
    e.preventDefault();

    if (!archiveForm.name.trim()) {
      alert("Please enter a semester name");
      return;
    }

    if (!showArchiveConfirm) {
      // Fetch preview before showing confirmation
      await fetchArchivePreview();
      setShowArchiveConfirm(true);
      return;
    }

    setArchiveLoading(true);
    try {
      const res = await postWithSignature(`${API.archive}/create`, 'admin_post_archive_create', {
        name: archiveForm.name,
        description: archiveForm.description
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Semester "${result.archive.name}" archived successfully!\n\nArchived:\n- ${result.archive.stats.totalProfiles} profiles\n- ${result.archive.stats.totalProjects} projects\n- ${result.archive.stats.totalPosts} posts\n- ${result.archive.stats.totalTransactions} transactions`);
        setArchiveForm({ name: "", description: "" });
        setShowArchiveConfirm(false);
        fetchSemesterArchives();
        fetchDashboard();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Archive failed: " + (error.error || error));
      }
    } catch (err) {
      console.error("Create archive error:", err);
      alert("Error creating archive. Please check your wallet connection.");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleClearSiteData = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setArchiveLoading(true);
    try {
      const res = await postWithSignature(`${API.archive}/clear-current`, 'admin_post_archive_clear', {
        confirmed: true
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Site data cleared successfully!\n\nDeleted:\n- ${result.deleted.profiles} profiles\n- ${result.deleted.projects} projects\n- ${result.deleted.posts} posts\n- ${result.deleted.comments} comments\n- ${result.deleted.transactions} transactions\n- ${result.deleted.bounties} bounties`);
        setShowClearConfirm(false);
        fetchDashboard();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Clear failed: " + (error.error || error));
      }
    } catch (err) {
      console.error("Clear site data error:", err);
      alert("Error clearing site data. Please check your wallet connection.");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleDeleteArchive = async (archiveId, archiveName) => {
    if (!window.confirm(`Are you sure you want to permanently delete the archive "${archiveName}"?\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const res = await postWithSignature(`${API.archive}/delete`, 'admin_post_archive_delete', {
        archiveId
      });

      if (res.ok) {
        alert('Archive deleted successfully');
        fetchSemesterArchives();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Delete failed: " + (error.error || error));
      }
    } catch (err) {
      console.error("Delete archive error:", err);
      alert("Error deleting archive. Please check your wallet connection.");
    }
  };

  const handleUpdateArchive = async (e) => {
    e.preventDefault();

    if (!editingArchive) return;

    try {
      const res = await postWithSignature(`${API.archive}/update`, 'admin_post_archive_update', {
        archiveId: editingArchive._id,
        name: archiveForm.name,
        description: archiveForm.description
      });

      if (res.ok) {
        alert('Archive updated successfully');
        setEditingArchive(null);
        setArchiveForm({ name: "", description: "" });
        fetchSemesterArchives();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        alert("Update failed: " + (error.error || error));
      }
    } catch (err) {
      console.error("Update archive error:", err);
      alert("Error updating archive. Please check your wallet connection.");
    }
  };

  if (!wallet) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>🛡️ Admin Panel</h1>
        <button onClick={connectWallet}>Connect Wallet</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>🚫 Access Denied</h1>
        <p>This page is only accessible to administrators.</p>
        <p><strong>Connected wallet:</strong> {wallet}</p>
        <p><strong>Expected admin wallet:</strong> {ADMIN_WALLET}</p>
        <p><strong>Wallet match:</strong> {wallet?.toLowerCase() === ADMIN_WALLET ? "✅ Yes" : "❌ No"}</p>
        <div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          <p>Debug info:</p>
          <p>Connected (lowercase): {wallet?.toLowerCase()}</p>
          <p>Expected (lowercase): {ADMIN_WALLET}</p>
        </div>
        <Link to="/">Go to Home</Link>
      </div>
    );
  }

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div className="v2-masthead">
        <div className="v2-kicker">CritCoin · Admin</div>
        <h1 className="gothic-title gothic-text">🛡️ Admin Panel</h1>
      </div>

      <p><strong>Admin:</strong> {wallet}</p>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "2rem" }}>
        {["dashboard", "profiles", "posts", "feed", "projects", "bounties", "predictions", "pages", "whitelist", "semester", "deploy", "chainsync", "reconcile"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              margin: "0 0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: activeTab === tab ? "var(--primary-blue)" : "var(--surface-muted)",
              color: activeTab === tab ? "white" : "black",
              border: "1px solid var(--surface-card-border)",
              borderRadius: "4px",
              cursor: "pointer",
              textTransform: "capitalize"
            }}
          >
{tab === "deploy" ? "Deploy CritCoin" : tab === "chainsync" ? "Sync from Chain" : tab === "whitelist" ? "Whitelist" : tab === "semester" ? "Semester Archive" : tab === "predictions" ? "Predictions" : tab === "pages" ? "Page Visibility" : tab === "feed" ? "The Feed" : tab}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div>
          <h2>📊 Dashboard</h2>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "1rem" 
          }}>
            <div style={{ backgroundColor: "var(--surface-muted)", padding: "1rem", borderRadius: "8px" }}>
              <h4>Profiles</h4>
              <p>Active: {dashboard.profiles?.total || 0}</p>
              <p>Archived: {dashboard.profiles?.archived || 0}</p>
            </div>
            <div style={{ backgroundColor: "var(--surface-muted)", padding: "1rem", borderRadius: "8px" }}>
              <h4>Posts</h4>
              <p>Total: {dashboard.posts?.total || 0}</p>
              <p>Hidden: {dashboard.posts?.hidden || 0}</p>
            </div>
            <div style={{ backgroundColor: "var(--surface-muted)", padding: "1rem", borderRadius: "8px" }}>
              <h4>Bounties</h4>
              <p>Total: {dashboard.bounties?.total || 0}</p>
              <p>Active: {dashboard.bounties?.active || 0}</p>
            </div>
            <div style={{ backgroundColor: "var(--surface-muted)", padding: "1rem", borderRadius: "8px" }}>
              <h4>Projects</h4>
              <p>Total: {dashboard.projects?.total || 0}</p>
              <p>Archived: {dashboard.projects?.archived || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Profiles Tab */}
      {activeTab === "profiles" && (
        <div>
          <h2>👥 Profile Management</h2>
          {loading ? (
            <p>Loading profiles...</p>
          ) : (
            <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid var(--surface-card-border)",
                backgroundColor: "var(--surface-muted)",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 100px 100px", gap: "1rem" }}>
                  <span>Profile</span>
                  <span>Wallet</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
              </div>
              {profiles.map((profile, index) => (
                <div 
                  key={profile._id}
                  style={{ 
                    padding: "1rem", 
                    borderBottom: index < profiles.length - 1 ? "1px solid var(--surface-card-border)" : "none",
                    backgroundColor: profile.archived ? "var(--tint-warning)" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 100px 100px", gap: "1rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {profile.photo && (
                        <img
                          src={`${API.profiles}/photo/${profile.photo}`}
                          alt="Profile"
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            marginRight: "0.5rem"
                          }}
                        />
                      )}
                      <div>
                        <div><strong>{profile.name}</strong></div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{profile.starSign}</div>
                      </div>
                    </div>
                    <code style={{ fontSize: "0.8rem" }}>{profile.wallet.slice(0, 10)}...</code>
                    <span style={{ 
                      color: profile.archived ? "var(--status-warning)" : "var(--status-positive)",
                      fontWeight: "bold"
                    }}>
                      {profile.archived ? "Archived" : "Active"}
                    </span>
                    <button
                      onClick={() => handleArchiveProfile(profile.wallet, !profile.archived)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: profile.archived ? "var(--status-positive)" : "var(--status-negative)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      {profile.archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === "posts" && (
        <div>
          <h2>💬 Post Management</h2>
          {loading ? (
            <p>Loading posts...</p>
          ) : (
            <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid var(--surface-card-border)",
                backgroundColor: "var(--surface-muted)",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 100px", gap: "1rem" }}>
                  <span>Author</span>
                  <span>Content</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
              </div>
              {posts.map((post, index) => (
                <div 
                  key={post._id}
                  style={{ 
                    padding: "1rem", 
                    borderBottom: index < posts.length - 1 ? "1px solid var(--surface-card-border)" : "none",
                    backgroundColor: post.hidden ? "var(--tint-negative)" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 100px", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <strong>{post.authorName}</strong>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ 
                      maxHeight: "60px", 
                      overflow: "hidden",
                      textDecoration: post.hidden ? "line-through" : "none",
                      color: post.hidden ? "var(--status-negative)" : "inherit"
                    }}>
                      {post.content}
                    </div>
                    <span style={{ 
                      color: post.hidden ? "var(--status-negative)" : "var(--status-positive)",
                      fontWeight: "bold"
                    }}>
                      {post.hidden ? "Hidden" : "Visible"}
                    </span>
                    <button
                      onClick={() => handleHidePost(post._id, !post.hidden)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: post.hidden ? "var(--status-positive)" : "var(--status-negative)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      {post.hidden ? "Show" : "Hide"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The Feed Tab - the instructor's view, with authorship */}
      {activeTab === "feed" && (
        <div>
          <h2>The Feed</h2>
          <p style={{ color: "var(--text-muted)" }}>
            Students see the feed without names. This view, the database, and the semester archive keep full authorship.
          </p>

          <form onSubmit={handleSaveFeedSettings} style={{
            display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end",
            padding: "1rem", marginBottom: "1.5rem",
            background: "var(--surface-card)", border: "1px solid var(--surface-card-border)", borderRadius: "8px"
          }}>
            <label>Run starts (day 1)<br />
              <input className="artistic-input" type="date" value={feedForm.runStart}
                onChange={(e) => setFeedForm({ ...feedForm, runStart: e.target.value })} />
            </label>
            <label>Days<br />
              <input className="artistic-input" type="number" min="1" style={{ width: "6rem" }} value={feedForm.runDays}
                onChange={(e) => setFeedForm({ ...feedForm, runDays: e.target.value })} />
            </label>
            <label>Posts / day<br />
              <input className="artistic-input" type="number" min="1" style={{ width: "6rem" }} value={feedForm.dailyTarget}
                onChange={(e) => setFeedForm({ ...feedForm, dailyTarget: e.target.value })} />
            </label>
            <label>Time zone (what "today" means)<br />
              <input className="artistic-input" value={feedForm.timeZone}
                onChange={(e) => setFeedForm({ ...feedForm, timeZone: e.target.value })} />
            </label>
            <button className="artistic-btn" type="submit">Save</button>
          </form>

          {loading || !feedAdmin ? (
            <p>Loading feed...</p>
          ) : (
            <>
              <h3>Quota by student</h3>
              <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--surface-card-border)" }}>
                      <th style={{ padding: "0.5rem" }}>Student</th>
                      <th style={{ padding: "0.5rem" }}>Wallet</th>
                      <th style={{ padding: "0.5rem" }}>Today</th>
                      <th style={{ padding: "0.5rem" }}>{feedAdmin.config.runStart ? "This run" : "Total"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedAdmin.quotas.map((q) => (
                      <tr key={q.authorWallet} style={{ borderBottom: "1px solid var(--surface-card-border)" }}>
                        <td style={{ padding: "0.5rem" }}>{q.authorName}</td>
                        <td style={{ padding: "0.5rem" }}><code style={{ fontSize: "0.8rem" }}>{q.authorWallet.slice(0, 10)}...</code></td>
                        <td className="ledger-num" style={{ padding: "0.5rem", color: q.today >= q.dailyTarget ? "var(--status-positive)" : "inherit" }}>
                          {q.today} / {q.dailyTarget}
                        </td>
                        <td className="ledger-num" style={{ padding: "0.5rem" }}>
                          {q.runStatus === "unscheduled" ? q.run : `${q.run} / ${q.dailyTarget * q.runDays}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Posts ({feedAdmin.posts.length})</h3>
              <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
                {feedAdmin.posts.map((post, index) => (
                  <div key={post._id} style={{
                    display: "grid", gridTemplateColumns: "64px 180px 1fr 80px", gap: "1rem", alignItems: "center",
                    padding: "0.75rem 1rem",
                    borderBottom: index < feedAdmin.posts.length - 1 ? "1px solid var(--surface-card-border)" : "none",
                    backgroundColor: post.hidden ? "var(--tint-negative)" : "transparent"
                  }}>
                    <div style={{ width: 64, height: 64, background: "var(--surface-muted)" }}>
                      {post.images?.[0] && (
                        <img src={cloudinaryVariant(post.images[0].url, THUMB)} alt="" loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    <div>
                      <strong>{post.authorName}</strong>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {new Date(post.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ maxHeight: "60px", overflow: "hidden", textDecoration: post.hidden ? "line-through" : "none" }}>
                      {post.text}
                      {post.images?.length > 1 && <span style={{ color: "var(--text-muted)" }}> ({post.images.length} images)</span>}
                    </div>
                    <button
                      onClick={() => handleHideFeedPost(post._id, !post.hidden)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: post.hidden ? "var(--status-positive)" : "var(--status-negative)",
                        color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem"
                      }}
                    >
                      {post.hidden ? "Show" : "Hide"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div>
          <h2>🎨 Project Management</h2>
          {loading ? (
            <p>Loading projects...</p>
          ) : (
            <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid var(--surface-card-border)",
                backgroundColor: "var(--surface-muted)",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 100px 120px", gap: "1rem" }}>
                  <span>Author</span>
                  <span>Project</span>
                  <span>Number</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
              </div>
              {projects.map((project, index) => (
                <div 
                  key={project._id}
                  style={{ 
                    padding: "1rem", 
                    borderBottom: index < projects.length - 1 ? "1px solid var(--surface-card-border)" : "none",
                    backgroundColor: project.archived ? "var(--tint-warning)" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 100px 120px", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <strong>{project.authorName}</strong>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ 
                      textDecoration: project.archived ? "line-through" : "none",
                      color: project.archived ? "var(--status-warning)" : "inherit"
                    }}>
                      <div><strong>{project.title}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{project.description}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--status-positive)", marginTop: "0.25rem" }}>
                        {project.totalReceived} CC received
                      </div>
                    </div>
                    <span style={{ fontWeight: "bold" }}>
                      Project {project.projectNumber}
                    </span>
                    <span style={{ 
                      color: project.archived ? "var(--status-warning)" : "var(--status-positive)",
                      fontWeight: "bold"
                    }}>
                      {project.archived ? "Archived" : "Active"}
                    </span>
                    <button
                      onClick={() => handleArchiveProject(project._id, !project.archived)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: project.archived ? "var(--status-positive)" : "var(--status-negative)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      {project.archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bounties Tab */}
      {activeTab === "bounties" && (
        <div>
          <h2>🎯 Bounty Management</h2>
          
          {/* Bounty Form */}
          <div style={{ 
            backgroundColor: "var(--surface-muted)", 
            padding: "1rem", 
            borderRadius: "8px", 
            marginBottom: "2rem",
            border: "1px solid var(--surface-card-border)"
          }}>
            <h4>{editingBounty ? "Edit Bounty" : "Create New Bounty"}</h4>
            <form onSubmit={handleBountySubmit}>
              <input
                type="text"
                placeholder="Bounty Title"
                value={bountyForm.title}
                onChange={(e) => setBountyForm({...bountyForm, title: e.target.value})}
                required
                style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
              />
              <textarea
                placeholder="Bounty Description"
                value={bountyForm.description}
                onChange={(e) => setBountyForm({...bountyForm, description: e.target.value})}
                required
                rows={3}
                style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
              />
              <input
                type="number"
                placeholder="Reward (CritCoin)"
                value={bountyForm.reward}
                onChange={(e) => setBountyForm({...bountyForm, reward: e.target.value})}
                required
                min="1"
                style={{ width: "200px", padding: "0.5rem", marginBottom: "1rem", marginRight: "1rem" }}
              />
              <button 
                type="submit"
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--primary-blue)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginRight: "1rem"
                }}
              >
                {editingBounty ? "Update" : "Create"} Bounty
              </button>
              {editingBounty && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingBounty(null);
                    setBountyForm({ title: "", description: "", reward: "" });
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "var(--text-muted)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          {/* Bounties List */}
          {loading ? (
            <p>Loading bounties...</p>
          ) : (
            <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid var(--surface-card-border)",
                backgroundColor: "var(--surface-muted)",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 200px", gap: "1rem" }}>
                  <span>Bounty</span>
                  <span>Reward</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
              </div>
              {bounties.map((bounty, index) => (
                <div 
                  key={bounty._id}
                  style={{ 
                    padding: "1rem", 
                    borderBottom: index < bounties.length - 1 ? "1px solid var(--surface-card-border)" : "none",
                    backgroundColor: bounty.crossedOut ? "var(--tint-negative)" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 200px", gap: "1rem", alignItems: "center" }}>
                    <div style={{ 
                      textDecoration: bounty.crossedOut ? "line-through" : "none",
                      color: bounty.crossedOut ? "var(--status-negative)" : "inherit"
                    }}>
                      <div><strong>{bounty.title}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{bounty.description}</div>
                    </div>
                    <span style={{ fontWeight: "bold", color: "var(--status-positive)" }}>
                      {bounty.reward} CC
                    </span>
                    <span style={{ 
                      color: bounty.crossedOut ? "var(--status-negative)" : "var(--status-positive)",
                      fontWeight: "bold"
                    }}>
                      {bounty.crossedOut ? "Crossed" : bounty.status}
                    </span>
                    <div>
                      <button
                        onClick={() => {
                          setEditingBounty(bounty);
                          setBountyForm({
                            title: bounty.title,
                            description: bounty.description,
                            reward: bounty.reward.toString()
                          });
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "var(--primary-blue)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          marginRight: "0.25rem"
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleCrossOutBounty(bounty._id, !bounty.crossedOut)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: bounty.crossedOut ? "var(--status-positive)" : "var(--status-negative)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          marginRight: "0.25rem"
                        }}
                      >
                        {bounty.crossedOut ? "Restore" : "Cross Out"}
                      </button>
                      <button
                        onClick={() => handleDeleteBounty(bounty._id, bounty.title)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "var(--text-muted)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.7rem"
                        }}
                        title="Permanently delete bounty"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Predictions Tab */}
      {activeTab === "predictions" && (
        <div>
          <h2>Prediction Market Controls</h2>
          <p>Enable or disable each project's prediction market. When closed, users cannot submit new predictions.</p>
          {[2, 3, 4, 5].map(projectNum => {
            const key = `predictionEnabled${projectNum}`;
            const isEnabled = settings[key] !== false;
            return (
              <div key={projectNum} style={{
                backgroundColor: isEnabled ? "var(--tint-positive)" : "var(--tint-warning)",
                padding: "1.25rem 1.5rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                border: `1px solid ${isEnabled ? "var(--status-positive)" : "var(--status-warning)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem 0" }}>
                    Project {projectNum} — <span style={{ color: isEnabled ? "var(--status-positive)" : "var(--status-warning)" }}>{isEnabled ? "OPEN" : "CLOSED"}</span>
                  </h4>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    Who will earn the most CritCoin in Project {projectNum}?
                  </p>
                </div>
                <button
                  onClick={() => handleTogglePrediction(projectNum, isEnabled)}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: isEnabled ? "var(--status-negative)" : "var(--status-positive)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    whiteSpace: "nowrap"
                  }}
                >
                  {isEnabled ? "Close Predictions" : "Open Predictions"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Page Visibility Tab */}
      {activeTab === "pages" && (
        <div>
          <h2>Page Visibility</h2>
          <p>Show or hide a page for students, so it can be revealed when it's introduced in class. A hidden page drops out of the student nav and its API refuses students; you still see and can use it. Nothing is deleted, and archived semesters ignore this.</p>
          {!pageVisibility ? (
            <p>Loading...</p>
          ) : Object.entries(pageVisibility.pages).map(([page, label]) => {
            const isVisible = pageVisibility.visibility[page] !== false;
            return (
              <div key={page} style={{
                backgroundColor: isVisible ? "var(--tint-positive)" : "var(--tint-warning)",
                padding: "1.25rem 1.5rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                border: `1px solid ${isVisible ? "var(--status-positive)" : "var(--status-warning)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <h4 style={{ margin: 0 }}>
                  {label} — <span style={{ color: isVisible ? "var(--status-positive)" : "var(--status-warning)" }}>{isVisible ? "VISIBLE" : "HIDDEN FROM STUDENTS"}</span>
                </h4>
                <button
                  onClick={() => handleTogglePageVisibility(page, isVisible)}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: isVisible ? "var(--status-negative)" : "var(--status-positive)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    whiteSpace: "nowrap"
                  }}
                >
                  {isVisible ? "Hide from Students" : "Show to Students"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Whitelist Tab */}
      {activeTab === "whitelist" && (
        <div>
          <h2>🔐 Whitelist Management</h2>
          {/* Add to Whitelist Form */}
          <div style={{ 
            backgroundColor: "var(--surface-muted)", 
            padding: "1rem", 
            borderRadius: "8px", 
            marginBottom: "2rem",
            border: "1px solid var(--surface-card-border)"
          }}>
            <h4>Add Wallet to Whitelist</h4>
            <form onSubmit={handleAddToWhitelist}>
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 1fr auto", gap: "1rem", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "bold" }}>
                    Wallet Address *
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={whitelistForm.wallet}
                    onChange={(e) => setWhitelistForm({...whitelistForm, wallet: e.target.value})}
                    required
                    style={{ 
                      width: "100%", 
                      padding: "0.5rem", 
                      borderRadius: "4px", 
                      border: "1px solid var(--surface-card-border)"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "bold" }}>
                    Student name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Name on the roster..."
                    value={whitelistForm.label}
                    onChange={(e) => setWhitelistForm({...whitelistForm, label: e.target.value})}
                    style={{ 
                      width: "100%", 
                      padding: "0.5rem", 
                      borderRadius: "4px", 
                      border: "1px solid var(--surface-card-border)"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "bold" }}>
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Reason for whitelisting..."
                    value={whitelistForm.notes}
                    onChange={(e) => setWhitelistForm({...whitelistForm, notes: e.target.value})}
                    style={{ 
                      width: "100%", 
                      padding: "0.5rem", 
                      borderRadius: "4px", 
                      border: "1px solid var(--surface-card-border)"
                    }}
                  />
                </div>
                <button 
                  type="submit"
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "var(--primary-blue)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Add to Whitelist
                </button>
              </div>
            </form>
          </div>

          {/* Whitelist Entries */}
          <h4>Whitelisted Wallets ({whitelist.length})</h4>
          {loading ? (
            <p>Loading whitelist...</p>
          ) : whitelist.length === 0 ? (
            <div style={{ 
              backgroundColor: "var(--surface-muted)", 
              padding: "2rem", 
              textAlign: "center", 
              borderRadius: "8px",
              border: "1px solid var(--surface-card-border)"
            }}>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>No wallets in whitelist yet</p>
            </div>
          ) : (
            <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid var(--surface-card-border)",
                backgroundColor: "var(--surface-muted)",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "250px 160px 1fr 150px 100px", gap: "1rem" }}>
                  <span>Wallet Address</span>
                  <span>Student</span>
                  <span>Notes</span>
                  <span>Added</span>
                  <span>Actions</span>
                </div>
              </div>
              {whitelist.map((entry, index) => (
                <div 
                  key={entry._id}
                  style={{ 
                    padding: "1rem", 
                    borderBottom: index < whitelist.length - 1 ? "1px solid var(--surface-card-border)" : "none"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "250px 160px 1fr 150px 100px", gap: "1rem", alignItems: "center" }}>
                    <code style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
                      {entry.wallet}
                    </code>
                    <span style={{ fontSize: "0.9rem" }}>
                      {entry.label || <em style={{ color: "var(--text-faint)" }}>--</em>}
                    </span>
                    <span style={{ fontSize: "0.9rem" }}>
                      {entry.notes || <em style={{ color: "var(--text-faint)" }}>No notes</em>}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleRemoveFromWhitelist(entry.wallet)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "var(--status-negative)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Semester Archive Tab */}
      {activeTab === "semester" && (
        <div>
          <h2>📦 Semester Archive</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
            Archive the current semester's data before starting a new class. This preserves all profiles, projects, posts, and transactions for future reference.
          </p>

          {/* Create New Archive */}
          <div style={{
            backgroundColor: "var(--tint-info)",
            border: "1px solid var(--primary-blue)",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem"
          }}>
            <h3 style={{ marginTop: 0 }}>Create New Archive</h3>
            <form onSubmit={editingArchive ? handleUpdateArchive : handleCreateArchive}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                  Semester Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Fall 2024, Spring 2025"
                  value={archiveForm.name}
                  onChange={(e) => setArchiveForm({...archiveForm, name: e.target.value})}
                  required
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--surface-card-border)"
                  }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Introduction to Digital Art"
                  value={archiveForm.description}
                  onChange={(e) => setArchiveForm({...archiveForm, description: e.target.value})}
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--surface-card-border)"
                  }}
                />
              </div>

              {!showArchiveConfirm ? (
                <button
                  type="submit"
                  disabled={archiveLoading || !archiveForm.name.trim()}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: editingArchive ? "var(--primary-blue)" : "var(--status-positive)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: archiveLoading || !archiveForm.name.trim() ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    opacity: archiveLoading || !archiveForm.name.trim() ? 0.6 : 1,
                    marginRight: "1rem"
                  }}
                >
                  {editingArchive ? "Update Archive" : "📦 Archive Current Semester"}
                </button>
              ) : (
                <div style={{
                  backgroundColor: "var(--tint-warning)",
                  border: "1px solid var(--status-warning)",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginTop: "1rem"
                }}>
                  <h4 style={{ color: "var(--status-warning)", marginTop: 0 }}>⚠️ Confirm Archive</h4>
                  <p>This will create a snapshot of all current data:</p>
                  <ul style={{ textAlign: "left" }}>
                    <li>{archivePreview?.profiles || 0} profiles</li>
                    <li>{archivePreview?.projects || 0} projects</li>
                    <li>{archivePreview?.posts || 0} posts</li>
                    <li>{archivePreview?.comments || 0} comments</li>
                    <li>{archivePreview?.transactions || 0} transactions</li>
                    <li>{archivePreview?.bounties || 0} bounties</li>
                  </ul>
                  <button
                    type="submit"
                    disabled={archiveLoading}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "var(--status-positive)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: archiveLoading ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      marginRight: "1rem"
                    }}
                  >
                    {archiveLoading ? "Archiving..." : "✅ Yes, Create Archive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchiveConfirm(false)}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "var(--text-muted)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {editingArchive && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingArchive(null);
                    setArchiveForm({ name: "", description: "" });
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "var(--text-muted)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* Clear Current Site Data */}
          <div style={{
            backgroundColor: "var(--tint-negative)",
            border: "1px solid var(--status-negative)",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem"
          }}>
            <h3 style={{ marginTop: 0, color: "var(--status-negative)" }}>🗑️ Clear Current Site Data</h3>
            <p style={{ color: "var(--status-negative)" }}>
              After archiving, you can clear the current site data to start fresh for a new semester.
              <br /><strong>Warning:</strong> This will permanently delete all current profiles (except admin), projects, posts, comments, transactions, and bounties.
            </p>

            {!showClearConfirm ? (
              <button
                onClick={handleClearSiteData}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "var(--status-negative)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                🗑️ Clear All Current Data
              </button>
            ) : (
              <div style={{
                backgroundColor: "var(--surface-card)",
                border: "2px solid var(--status-negative)",
                borderRadius: "8px",
                padding: "1rem",
                marginTop: "1rem"
              }}>
                <h4 style={{ color: "var(--status-negative)", marginTop: 0 }}>⚠️ DANGER ZONE</h4>
                <p><strong>Are you absolutely sure?</strong> This action cannot be undone!</p>
                <p>Make sure you have archived the current semester first.</p>
                <button
                  onClick={handleClearSiteData}
                  disabled={archiveLoading}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "var(--status-negative)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: archiveLoading ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    marginRight: "1rem"
                  }}
                >
                  {archiveLoading ? "Clearing..." : "🗑️ Yes, Delete Everything"}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "var(--text-muted)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Existing Archives */}
          <h3>Existing Archives ({semesterArchives.length})</h3>
          {archiveLoading ? (
            <p>Loading archives...</p>
          ) : semesterArchives.length === 0 ? (
            <div style={{
              backgroundColor: "var(--surface-muted)",
              padding: "2rem",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px solid var(--surface-card-border)"
            }}>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>No semester archives yet</p>
            </div>
          ) : (
            <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
              <div style={{
                padding: "1rem",
                borderBottom: "1px solid var(--surface-card-border)",
                backgroundColor: "var(--surface-muted)",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 150px 200px", gap: "1rem" }}>
                  <span>Semester</span>
                  <span>Statistics</span>
                  <span>Archived</span>
                  <span>Actions</span>
                </div>
              </div>
              {semesterArchives.map((archive, index) => (
                <div
                  key={archive._id}
                  style={{
                    padding: "1rem",
                    borderBottom: index < semesterArchives.length - 1 ? "1px solid var(--surface-card-border)" : "none"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 150px 200px", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{archive.name}</div>
                      {archive.description && (
                        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{archive.description}</div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      <div>{archive.stats?.totalProfiles || 0} profiles</div>
                      <div>{archive.stats?.totalProjects || 0} projects</div>
                      <div>{archive.stats?.totalPosts || 0} posts</div>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {new Date(archive.archivedAt).toLocaleDateString()}
                    </div>
                    <div>
                      <Link
                        to={`/archive/${archive._id}`}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "var(--primary-blue)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          textDecoration: "none",
                          fontSize: "0.8rem",
                          marginRight: "0.5rem"
                        }}
                      >
                        View
                      </Link>
                      <button
                        onClick={() => {
                          setEditingArchive(archive);
                          setArchiveForm({ name: archive.name, description: archive.description || "" });
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "var(--status-warning)",
                          color: "var(--text-body)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          marginRight: "0.5rem"
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteArchive(archive._id, archive.name)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "var(--status-negative)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem"
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deploy CritCoin Tab - profile checklist, browser-side MetaMask deploy */}
      {activeTab === "deploy" && (() => {
        const cell = { padding: "0.5rem", border: "1px solid var(--surface-card-border)" };
        const students = deployRoster || [];
        const eligible = students.filter((s) => !s.isAdmin);
        const checkedCount = eligible.filter((s) => deploySelected[s.wallet]).length;
        const amount = Number(deployAmount);
        const amountValid = Number.isSafeInteger(amount) && amount > 0;
        const setAll = (value) =>
          setDeploySelected(Object.fromEntries(students.map((s) => [s.wallet, value && !s.isAdmin])));
        const toneColor = {
          positive: "var(--status-positive)",
          warning: "var(--status-warning)",
          negative: "var(--status-negative)",
          muted: "var(--text-muted)"
        };
        const button = (enabled) => ({
          padding: "0.5rem 1rem",
          border: "1px solid var(--surface-card-border)",
          borderRadius: "6px",
          cursor: enabled ? "pointer" : "not-allowed",
          opacity: enabled ? 1 : 0.6
        });
        const busy = deployRunning || gasRunning;
        const lowWei = parseEthOrNull(gasLow);
        const targetValid = Boolean(parseEthOrNull(gasTarget));
        const topUps = gasTopUps();
        const topUpTotal = topUps.reduce((sum, s) => sum.add(s.topUp), ethers.BigNumber.from(0));

        return (
          <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
            <h2>🚀 Deploy CritCoin</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Sends CritCoin from your MetaMask wallet to each checked student, one transfer at a time.
              Nothing goes through the server; afterwards the Etherscan sync imports the transfers as admin grants.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", margin: "1rem 0" }}>
              <label>
                Amount per student{" "}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={deployAmount}
                  onChange={(e) => setDeployAmount(e.target.value)}
                  disabled={busy}
                  style={{ width: "8rem", padding: "0.4rem" }}
                />
              </label>
              <button onClick={() => setAll(true)} disabled={busy} style={button(!busy)}>Select all</button>
              <button onClick={() => setAll(false)} disabled={busy} style={button(!busy)}>Select none</button>
            </div>

            <p style={{ fontWeight: "bold" }}>
              {amountValid
                ? `Deploy ${amount.toLocaleString()} to ${checkedCount} student${checkedCount === 1 ? "" : "s"} = ${(amount * checkedCount).toLocaleString()} CritCoin total.`
                : "Enter a positive whole number amount."}
            </p>

            <button
              onClick={runDeploy}
              disabled={busy || !amountValid || checkedCount === 0}
              style={{
                ...button(!busy && amountValid && checkedCount > 0),
                backgroundColor: "var(--status-positive)",
                color: "white",
                fontWeight: "bold",
                padding: "0.75rem 1.5rem"
              }}
            >
              {deployRunning ? "Deploying…" : "🚀 Deploy"}
            </button>
            {!busy && Object.keys(deployStatus).length > 0 && (
              <button onClick={() => syncDeployGrants()} style={{ ...button(true), marginLeft: "0.75rem" }}>
                Sync now
              </button>
            )}

            {deployMessage && (
              <p style={{ color: toneColor[deployMessage.tone] || "inherit", marginTop: "1rem" }}>
                {deployMessage.text}
              </p>
            )}

            <h3 style={{ marginTop: "2rem" }}>⛽ Send gas</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Tops up checked students' Sepolia ETH to the target from your MetaMask wallet, so they can pay for
              their own CritCoin transfers. Each student gets only the difference. Gas is not CritCoin: these sends
              never enter the ledger.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", margin: "1rem 0" }}>
              <label>
                Low below{" "}
                <input
                  type="number" min="0" step="0.001" value={gasLow}
                  onChange={(e) => setGasLow(e.target.value)} disabled={busy}
                  style={{ width: "6rem", padding: "0.4rem" }}
                />{" "}ETH
              </label>
              <label>
                Top up to{" "}
                <input
                  type="number" min="0" step="0.001" value={gasTarget}
                  onChange={(e) => setGasTarget(e.target.value)} disabled={busy}
                  style={{ width: "6rem", padding: "0.4rem" }}
                />{" "}ETH
              </label>
              <button onClick={() => fetchGasBalances()} disabled={busy || !deployRoster} style={button(!busy && Boolean(deployRoster))}>
                Refresh ETH
              </button>
            </div>
            <p style={{ fontWeight: "bold" }}>
              {targetValid
                ? `Send ${ethers.utils.formatEther(topUpTotal)} ETH total to ${topUps.length} student${topUps.length === 1 ? "" : "s"}.`
                : "Enter a positive target amount."}
            </p>
            <button
              onClick={runSendGas}
              disabled={busy || topUps.length === 0}
              style={{ ...button(!busy && topUps.length > 0), fontWeight: "bold", padding: "0.75rem 1.5rem" }}
            >
              {gasRunning ? "Sending gas…" : "⛽ Send gas"}
            </button>
            {gasMessage && (
              <p style={{ color: toneColor[gasMessage.tone] || "inherit", marginTop: "1rem" }}>
                {gasMessage.text}
              </p>
            )}

            {!deployRoster ? (
              <p style={{ color: "var(--text-muted)" }}>Loading active profiles…</p>
            ) : (
              <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  {students.length} active profile{students.length === 1 ? "" : "s"}
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--surface-muted)", textAlign: "left" }}>
                      <th style={cell}></th>
                      <th style={cell}>Student</th>
                      <th style={cell}>Wallet</th>
                      <th style={cell}>Granted this semester</th>
                      <th style={cell}>Deploy status</th>
                      <th style={cell}>ETH</th>
                      <th style={cell}>Gas</th>
                      <th style={cell}>Gas status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const row = deployStatus[s.wallet];
                      const awaitingSync = row?.state === "sent" && !s.grantHashes.includes(row.hash?.toLowerCase());
                      const gasRow = gasStatus[s.wallet];
                      const eth = gasBalances[s.wallet];
                      const isLow = Boolean(eth && lowWei && !s.isAdmin && eth.lt(lowWei));
                      return (
                        <tr key={s.wallet}>
                          <td style={cell}>
                            <input
                              type="checkbox"
                              checked={Boolean(deploySelected[s.wallet])}
                              disabled={s.isAdmin || busy}
                              onChange={(e) => setDeploySelected((prev) => ({ ...prev, [s.wallet]: e.target.checked }))}
                            />
                          </td>
                          <td style={cell}>{s.name}</td>
                          <td style={cell}><AddressLink address={s.wallet} /></td>
                          <td style={cell}>
                            {s.isAdmin
                              ? <span style={{ color: "var(--text-muted)" }}>admin wallet</span>
                              : s.grantCount > 0
                                ? `✓ ${s.granted.toLocaleString()} CC${s.grantCount > 1 ? ` (${s.grantCount} grants)` : ""}`
                                : <span style={{ color: "var(--text-muted)" }}>none</span>}
                            {awaitingSync && (
                              <span style={{ color: "var(--accent-orange)", marginLeft: "0.5rem" }}>+ sent, awaiting sync</span>
                            )}
                          </td>
                          <td style={cell}>
                            {row ? (
                              <>
                                <span style={{ color: DEPLOY_STATUS_COLORS[row.state], fontWeight: "bold" }}>
                                  {DEPLOY_STATUS_LABELS[row.state]}
                                </span>
                                {row.hash && <> · <TxLink hash={row.hash} /></>}
                                {row.error && (
                                  <div style={{ color: "var(--status-negative)", fontSize: "0.8rem" }}>{row.error}</div>
                                )}
                              </>
                            ) : "—"}
                          </td>
                          <td style={cell}>
                            {eth ? (
                              <span style={{ color: isLow ? "var(--status-negative)" : "inherit", fontWeight: isLow ? "bold" : "normal" }}>
                                {formatEth(eth)}{isLow && " · low"}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={cell}>
                            <input
                              type="checkbox"
                              checked={Boolean(gasSelected[s.wallet])}
                              disabled={s.isAdmin || busy}
                              onChange={(e) => setGasSelected((prev) => ({ ...prev, [s.wallet]: e.target.checked }))}
                            />
                          </td>
                          <td style={cell}>
                            {gasRow ? (
                              <>
                                <span style={{ color: DEPLOY_STATUS_COLORS[gasRow.state], fontWeight: "bold" }}>
                                  {DEPLOY_STATUS_LABELS[gasRow.state]}
                                </span>
                                {gasRow.hash && <> · <TxLink hash={gasRow.hash} /></>}
                                {gasRow.error && (
                                  <div style={{ color: "var(--status-negative)", fontSize: "0.8rem" }}>{gasRow.error}</div>
                                )}
                              </>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Sync from Chain Tab - import on-chain transfers; manual adjustment */}
      {activeTab === "chainsync" && (() => {
        const cell = { padding: "0.4rem", border: "1px solid var(--surface-card-border)" };
        const who = (name, address) => name || `${address.slice(0, 6)}...${address.slice(-4)}`;
        const when = (t) => new Date(t).toLocaleString();
        const transferTable = (rows, lastColumn, lastValue) => (
          <div style={{ overflowX: "auto", maxHeight: "420px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--surface-muted)", textAlign: "left" }}>
                  <th style={cell}>Time</th><th style={cell}>From</th><th style={cell}>To</th>
                  <th style={cell}>Amount</th><th style={cell}>{lastColumn}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.txHash + r.to}>
                    <td style={cell}>{when(r.timestamp)}</td>
                    <td style={cell}>{who(r.fromName, r.from)}</td>
                    <td style={cell}>{who(r.toName, r.to)}</td>
                    <td style={cell}>{r.amount}</td>
                    <td style={cell}>{lastValue(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        return (
          <div>
            <h2>Sync from Chain</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "800px" }}>
              Imports on-chain CritCoin transfers (read from Etherscan) as ledger records. Sends from the
              admin wallet become <strong>admin grants</strong> (balance only, never investments). Student-to-student
              sends become investments in the recipient's submission for the active critique project. Anything else is
              skipped and listed. Re-running never creates duplicates. After the first sync, new transfers are imported
              automatically every 5 minutes using the settings below.
            </p>

            {chainSyncStatus && !chainSyncStatus.configured && (
              <p style={{ color: "var(--status-warning)", backgroundColor: "var(--tint-warning)", padding: "0.75rem", borderRadius: "4px" }}>
                ⚠️ ETHERSCAN_API_KEY is not set on the server — sync is unavailable.
              </p>
            )}
            {chainSyncStatus && (
              <p style={{ fontSize: "0.9rem" }}>
                Auto-sync:{" "}
                {chainSyncStatus.settings.since
                  ? <>on — Project {chainSyncStatus.settings.activeProject}, transfers since {when(chainSyncStatus.settings.since)}</>
                  : "off until the first sync below"}
                {chainSyncStatus.lastAutoSync && (
                  <> · last run {when(chainSyncStatus.lastAutoSync.at)}:{" "}
                    {chainSyncStatus.lastAutoSync.error
                      ? <span style={{ color: "var(--status-negative)" }}>{chainSyncStatus.lastAutoSync.error}</span>
                      : `${chainSyncStatus.lastAutoSync.imported} imported, ${chainSyncStatus.lastAutoSync.mismatches} balance mismatch(es)`}
                  </>
                )}
              </p>
            )}

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end", marginBottom: "1rem" }}>
              <label>
                Active critique<br />
                <select
                  value={chainSyncForm.project}
                  onChange={(e) => { setChainSyncForm({ ...chainSyncForm, project: Number(e.target.value) }); setChainSyncPreview(null); }}
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Project {n}</option>)}
                </select>
              </label>
              <label>
                Transfers since<br />
                <input
                  type="datetime-local"
                  value={chainSyncForm.since}
                  onChange={(e) => { setChainSyncForm({ ...chainSyncForm, since: e.target.value }); setChainSyncPreview(null); }}
                />
              </label>
              <button onClick={previewChainSync} disabled={chainSyncLoading || !chainSyncForm.since}>
                {chainSyncLoading && !chainSyncPreview ? "Loading..." : "Preview"}
              </button>
            </div>

            {chainSyncPreview && (
              <div style={{ marginBottom: "2rem" }}>
                <h3>Preview — nothing has been written</h3>
                <p>
                  <strong>{chainSyncPreview.counts.adminGrant}</strong> admin grant(s) ·{" "}
                  <strong>{chainSyncPreview.counts.investment}</strong> Project {chainSyncPreview.activeProject} investment(s) ·{" "}
                  <strong>{chainSyncPreview.counts.skipped}</strong> skipped ·{" "}
                  {chainSyncPreview.counts.alreadyImported} already imported
                </p>
                {transferTable(chainSyncPreview.toImport, "Classification", (r) =>
                  r.type === "adminGrant" ? "Admin grant" : `Investment → ${r.projectTitle}`)}
                {chainSyncPreview.skipped.length > 0 && (
                  <>
                    <h4>Skipped</h4>
                    {transferTable(chainSyncPreview.skipped, "Reason", (r) => r.reason)}
                  </>
                )}
                <button
                  onClick={commitChainSync}
                  disabled={chainSyncLoading || chainSyncPreview.toImport.length === 0}
                  style={{ marginTop: "1rem", padding: "0.75rem 1.5rem", backgroundColor: "var(--status-positive)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  {chainSyncLoading ? "Importing..." : `Confirm — import ${chainSyncPreview.toImport.length} transfer(s)`}
                </button>
              </div>
            )}

            {chainSyncResult && (
              <div style={{ marginBottom: "2rem" }}>
                <h3>✅ Imported {chainSyncResult.imported} transfer(s)</h3>
                <p>
                  {chainSyncResult.counts.adminGrant} admin grant(s), {chainSyncResult.counts.investment} investment(s) ·{" "}
                  {chainSyncResult.counts.skipped} skipped · {chainSyncResult.counts.alreadyImported} already imported
                </p>
                <h4>Balances: ledger vs chain</h4>
                {chainSyncResult.balances.mismatches.length === 0 ? (
                  <p>Every student's balance matches the chain.</p>
                ) : (
                  <table style={{ borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-muted)", textAlign: "left" }}>
                        <th style={cell}>Student</th><th style={cell}>Ledger</th><th style={cell}>Chain</th><th style={cell}>Drift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chainSyncResult.balances.mismatches.map((r) => (
                        <tr key={r.wallet}>
                          <td style={cell}>{r.name}</td><td style={cell}>{r.dbBalance}</td>
                          <td style={cell}>{r.chainBalance}</td>
                          <td style={{ ...cell, color: "var(--status-negative)", fontWeight: "bold" }}>{r.drift}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <h2>Manual adjustment</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "800px" }}>
              For mistakes that can't be fixed on-chain. Changes the balance only — never counts as an investment.
              Normal distributions should be real sends from the admin wallet, which the sync picks up as admin grants.
            </p>
            <form onSubmit={submitAdjustment} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Wallet (0x...)"
                value={adjustForm.wallet}
                onChange={(e) => setAdjustForm({ ...adjustForm, wallet: e.target.value })}
                style={{ width: "26rem", maxWidth: "100%" }}
                required
              />
              <input
                type="number"
                step="1"
                placeholder="Amount (+ or −)"
                value={adjustForm.amount}
                onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                required
              />
              <input
                placeholder="Note"
                value={adjustForm.note}
                onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                style={{ width: "20rem", maxWidth: "100%" }}
                required
              />
              <button type="submit">Record adjustment</button>
            </form>
          </div>
        );
      })()}

      {/* Reconciliation Tab - read-only diagnostic */}
      {activeTab === "reconcile" && (
        <div>
          <h2>Reconciliation</h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "800px" }}>
            The database ledger is authoritative for every balance in the app. This compares it against
            live on-chain balances so drift is visible. It is read-only — nothing here writes to the
            database or sends a transaction, and drift is never corrected automatically.
          </p>

          <button onClick={fetchReconcile} disabled={reconcileLoading} style={{ marginBottom: "1rem" }}>
            {reconcileLoading ? "Loading..." : "Refresh"}
          </button>

          {reconcile && (
            <>
              {!reconcile.chainAvailable && (
                <p style={{ color: "var(--status-warning)", backgroundColor: "var(--tint-warning)", padding: "0.75rem", borderRadius: "4px" }}>
                  ⚠️ Sepolia RPC unavailable — database balances shown, chain values unavailable.
                </p>
              )}

              <p style={{ fontSize: "0.9rem" }}>
                Transactions with no hash: <strong>{reconcile.transactionHashes.missing}</strong> ·
                {" "}legacy fabricated hashes: <strong>{reconcile.transactionHashes.fabricated}</strong>
              </p>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--surface-muted)", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Student</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Wallet</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Database</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Chain</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Drift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconcile.students.map(s => (
                      <tr key={s.wallet}>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>{s.name}</td>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>
                          <AddressLink address={s.wallet} />
                        </td>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>{s.dbBalance}</td>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>
                          {s.chainBalance === null ? "unavailable" : s.chainBalance}
                        </td>
                        <td style={{
                          padding: "0.5rem",
                          border: "1px solid var(--surface-card-border)",
                          fontWeight: s.drift ? "bold" : "normal",
                          color: s.drift ? "var(--status-negative)" : "inherit"
                        }}>
                          {s.drift === null ? "—" : s.drift}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}