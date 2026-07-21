// src/pages/Admin.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";
import { AddressLink, TxLink } from "../components/ChainLink";
import { authorizedFetch } from "../utils/auth";

// How each per-student deploy row reads in the status table.
const DEPLOY_STATUS_LABELS = {
  pending: "pending",
  credited: "credited (awaiting chain)",
  chain_confirmed: "confirmed on-chain",
  chain_failed: "chain transfer failed"
};

const DEPLOY_STATUS_COLORS = {
  pending: "var(--text-muted)",
  credited: "var(--accent-orange)",
  chain_confirmed: "var(--status-positive)",
  chain_failed: "var(--status-negative)"
};

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
  const [loading, setLoading] = useState(false);
  
  // Deploy CritCoin confirmation
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployProgress, setDeployProgress] = useState({ current: 0, total: 0, failed: [] });
  const [latestDeploy, setLatestDeploy] = useState(null);
  const [reconcile, setReconcile] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  
  // Bounty form
  const [bountyForm, setBountyForm] = useState({ title: "", description: "", reward: "" });
  const [editingBounty, setEditingBounty] = useState(null);
  
  // Whitelist form (single add) + a separate bulk-paste field
  const [whitelistForm, setWhitelistForm] = useState({ wallet: "", label: "", notes: "" });
  const [bulkWhitelist, setBulkWhitelist] = useState("");

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
      if (activeTab === "bounties") fetchBounties();
      if (activeTab === "projects") fetchProjects();
      if (activeTab === "whitelist") {
        fetchSettings();
        fetchWhitelist();
      }
      if (activeTab === "predictions") fetchSettings();
      if (activeTab === "semester") fetchSemesterArchives();
      if (activeTab === "deploy") fetchLatestDeploy();
      if (activeTab === "reconcile") fetchReconcile();
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

  // Admin requests reuse the shared wallet session (one signature prompt per
  // session, established on first request). The server verifies the bearer
  // token and that the signed-in wallet is ADMIN_WALLET — see middleware/auth.js.
  // The `action` argument is kept for call-site compatibility but is no longer
  // used: identity is the token, not a per-request signed message. This also
  // removes the concurrent-signMessage race that made the panel show an error
  // while still working (audit finding A4).
  const fetchWithSignature = async (url) => {
    return authorizedFetch(url, {}, wallet);
  };

  const postWithSignature = async (url, action, data = {}) => {
    return authorizedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, wallet);
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

  // The whitelist is now the always-on gate for profile creation, so there is no
  // "whitelist mode" to toggle. This toggle instead controls the optional
  // 1-CritCoin welcome grant issued when a profile is created (default OFF).
  const handleToggleGrantOnCreate = async () => {
    try {
      const res = await postWithSignature(`${API.admin}/settings`, 'admin_post_settings', {
        key: "grantOnCreate",
        value: !settings.grantOnCreate
      });

      if (res.ok) {
        alert(`Welcome grant ${!settings.grantOnCreate ? 'enabled' : 'disabled'}`);
        fetchSettings();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Toggle grant-on-create error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Toggle grant-on-create error:", err);
      alert("Error toggling the welcome grant. Please check your wallet connection.");
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
        wallet: whitelistForm.wallet.trim(),
        label: whitelistForm.label,
        notes: whitelistForm.notes
      });

      const data = await res.json().catch(async () => ({ error: await res.text() }));
      if (res.ok) {
        alert(data.message || "Wallet added to whitelist");
        setWhitelistForm({ wallet: "", label: "", notes: "" });
        fetchWhitelist();
      } else {
        console.error("Add to whitelist error:", data);
        alert("Error: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error("Add to whitelist error:", err);
      alert("Error adding wallet to whitelist. Please check your wallet connection.");
    }
  };

  // Bulk add: paste any number of addresses separated by spaces, commas or
  // newlines. Malformed addresses are reported back per-address, not silently
  // dropped, and already-listed ones are skipped.
  const handleBulkAddToWhitelist = async (e) => {
    e.preventDefault();
    const wallets = bulkWhitelist.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean);
    if (wallets.length === 0) {
      alert("Paste one or more wallet addresses");
      return;
    }

    try {
      const res = await postWithSignature(`${API.admin}/whitelist/add`, 'admin_post_whitelist_add', { wallets });
      const data = await res.json().catch(async () => ({ error: await res.text() }));
      if (res.ok) {
        let msg = data.message || "Done";
        if (data.invalid && data.invalid.length) {
          msg += `\nInvalid: ${data.invalid.map((i) => i.wallet).join(", ")}`;
        }
        alert(msg);
        setBulkWhitelist("");
        fetchWhitelist();
      } else {
        console.error("Bulk add to whitelist error:", data);
        alert("Error: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error("Bulk add to whitelist error:", err);
      alert("Error adding wallets. Please check your wallet connection.");
    }
  };

  // Deliberate admin write (distinct from the read-only reconcile view): absorb
  // on-chain grants the admin/deployer wallet sent to students into the ledger.
  const handleSyncGrants = async () => {
    if (!window.confirm(
      "Absorb on-chain grants the admin/deployer wallet sent to students into the ledger?\n\n" +
      "Only transfers originating from the deployer wallet are recorded. Transfers between other " +
      "wallets stay as drift."
    )) return;

    try {
      const res = await postWithSignature(`${API.admin}/reconcile/sync-grants`, 'admin_post_sync_grants', {});
      const data = await res.json().catch(async () => ({ error: await res.text() }));
      if (res.ok) {
        alert(data.message || "Sync complete");
        fetchReconcile();
      } else {
        console.error("Sync grants error:", data);
        alert("Error: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error("Sync grants error:", err);
      alert("Error syncing admin grants. Please check your wallet connection.");
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

  // Load the most recent deploy round for the status table.
  const fetchLatestDeploy = async () => {
    try {
      const res = await fetchWithSignature(`${API.admin}/deploy/latest/${wallet}`, 'admin_get_deploy_latest');
      if (res.ok) {
        const data = await res.json();
        setLatestDeploy(data.deploy);
      }
    } catch (err) {
      console.error("Deploy status fetch error:", err);
    }
  };

  // Deploy CritCoin: credit the database ledger AND transfer real tokens.
  //
  // The backend runs preflight and credits Mongo; the browser signs each
  // transfer with MetaMask and reports each outcome back. Transfers are strictly
  // sequential - concurrent sends from one wallet collide on the nonce.
  //
  // Safe to re-run: chain_confirmed students are skipped, chain_failed students
  // are retried, and the backend never credits a student twice.
  const handleDeployCritCoin = async (resume = false) => {
    if (!showDeployConfirm && !resume) {
      setShowDeployConfirm(true);
      return;
    }

    if (!signer) {
      alert("Please connect your wallet first");
      return;
    }

    setDeployLoading(true);
    setDeployProgress({ current: 0, total: 0, failed: [] });

    try {
      // Preflight + ledger credit. Nothing is written if preflight fails.
      const startRes = await postWithSignature(`${API.admin}/deploy/start`, 'admin_post_deploy_start', {
        confirmed: true,
        resume
      });

      if (!startRes.ok) {
        const problem = await startRes.json().catch(() => ({ error: "Failed to start deploy" }));
        // Preflight failures carry a detailed shortfall - show it verbatim.
        const detail = [
          problem.error,
          problem.shortfall !== undefined
            ? `Short by ${problem.shortfall} CritCoin (need ${problem.required}, wallet holds ${problem.available}).`
            : null,
          problem.requiredEth
            ? `Need about ${problem.requiredEth} ETH for gas, wallet holds ${problem.availableEth} ETH.`
            : null,
          problem.hint
        ].filter(Boolean).join("\n\n");

        alert(`Deploy aborted.\n\n${detail}`);
        setDeployLoading(false);
        return;
      }

      const { deployId, amountPerStudent, rows } = await startRes.json();

      // Only students without a confirmed transfer still need one.
      const pending = rows.filter(r => r.status !== 'chain_confirmed');
      if (pending.length === 0) {
        alert("Every student already has a confirmed on-chain transfer. Nothing to do.");
        setShowDeployConfirm(false);
        await fetchLatestDeploy();
        setDeployLoading(false);
        return;
      }

      const contract = new ethers.Contract(deployed.address, deployed.abi, signer);
      const failed = [];
      setDeployProgress({ current: 0, total: pending.length, failed: [] });

      for (let i = 0; i < pending.length; i++) {
        const row = pending[i];
        try {
          console.log(`Transferring ${amountPerStudent} CritCoin to ${row.name} (${row.wallet})`);
          const tx = await contract.transfer(row.wallet, amountPerStudent);
          await tx.wait(); // one at a time: nonce safety

          await postWithSignature(`${API.admin}/deploy/record`, 'admin_post_deploy_record', {
            deployId,
            wallet: row.wallet,
            txHash: tx.hash
          });
          console.log(`Transfer to ${row.name} confirmed: ${tx.hash}`);
        } catch (err) {
          // Record the failure and keep going - one bad student must not stop
          // the rest of the roster.
          console.error(`Failed to transfer to ${row.name}:`, err);
          failed.push({ name: row.name, wallet: row.wallet, error: err.message });

          await postWithSignature(`${API.admin}/deploy/record`, 'admin_post_deploy_record', {
            deployId,
            wallet: row.wallet,
            error: err.message
          }).catch(recordErr => console.error("Failed to record failure:", recordErr));
        }
        setDeployProgress({ current: i + 1, total: pending.length, failed });
      }

      const succeeded = pending.length - failed.length;
      if (failed.length === 0) {
        alert(`CritCoin deployed successfully!\n${succeeded} students received ${amountPerStudent} CritCoin each, on-chain and in the ledger.`);
      } else {
        alert(
          `Deployment finished with ${failed.length} failure(s).\n` +
          `${succeeded} students confirmed on-chain.\n` +
          `Failed: ${failed.map(f => f.name).join(', ')}\n\n` +
          `All students were credited in the ledger. Re-run the deploy to retry the failed transfers.`
        );
      }

      setShowDeployConfirm(false);
      await fetchLatestDeploy();
    } catch (err) {
      console.error("Deploy CritCoin error:", err);
      alert("Error deploying CritCoin: " + err.message);
    } finally {
      setDeployLoading(false);
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
        {["dashboard", "profiles", "posts", "projects", "bounties", "predictions", "whitelist", "semester", "deploy", "reconcile"].map(tab => (
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
{tab === "deploy" ? "Deploy CritCoin" : tab === "whitelist" ? "Whitelist" : tab === "semester" ? "Semester Archive" : tab === "predictions" ? "Predictions" : tab}
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
          {[2, 3, 4].map(projectNum => {
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

      {/* Whitelist Tab */}
      {activeTab === "whitelist" && (
        <div>
          <h2>🔐 Whitelist Management</h2>
          {console.log("Rendering whitelist tab. Settings:", settings, "Whitelist:", whitelist)}
          
          {/* The whitelist is the always-on gate for profile creation. */}
          <div style={{
            backgroundColor: "var(--tint-info)",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            border: "1px solid var(--primary-blue)"
          }}>
            <h4 style={{ margin: "0 0 0.5rem 0" }}>🔒 Whitelist is always on</h4>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Only wallets on this roster can create a profile. Membership is the sole
              authorization gate — never a CritCoin balance. Existing students were seeded in
              automatically, and removing a wallet only blocks <em>new</em> profile creation; it never
              deletes or disables an existing profile.
            </p>
          </div>

          {/* Grant 1 CRIT on profile creation (default OFF) */}
          <div style={{
            backgroundColor: settings.grantOnCreate ? "var(--tint-info)" : "var(--tint-warning)",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            border: `1px solid ${settings.grantOnCreate ? "var(--primary-blue)" : "var(--status-warning)"}`
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <h4 style={{ margin: "0 0 0.5rem 0" }}>
                  {settings.grantOnCreate ? "🎁 Welcome grant: ON" : "🎁 Welcome grant: OFF"}
                </h4>
                <p style={{ margin: 0, color: "var(--text-muted)" }}>
                  {settings.grantOnCreate
                    ? "New profiles receive a 1-CritCoin off-chain welcome grant on creation."
                    : "New profiles start with 0 CritCoin. They can still post and submit — participation comes from having a profile, not a balance."}
                </p>
              </div>
              <button
                onClick={handleToggleGrantOnCreate}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: settings.grantOnCreate ? "var(--status-negative)" : "var(--status-positive)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  whiteSpace: "nowrap"
                }}
              >
                {settings.grantOnCreate ? "Turn OFF" : "Turn ON"}
              </button>
            </div>
          </div>

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
              <div style={{ display: "grid", gridTemplateColumns: "240px 160px 1fr auto", gap: "1rem", alignItems: "end" }}>
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
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Student name"
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
                  Add
                </button>
              </div>
            </form>
          </div>

          {/* Bulk add to Whitelist */}
          <div style={{
            backgroundColor: "var(--surface-muted)",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            border: "1px solid var(--surface-card-border)"
          }}>
            <h4>Bulk Add</h4>
            <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Paste many addresses separated by spaces, commas or newlines. Invalid addresses are
              reported back; already-listed ones are skipped.
            </p>
            <form onSubmit={handleBulkAddToWhitelist}>
              <textarea
                placeholder="0xabc...\n0xdef...\n0x123..."
                value={bulkWhitelist}
                onChange={(e) => setBulkWhitelist(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--surface-card-border)",
                  fontFamily: "monospace",
                  marginBottom: "0.5rem"
                }}
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
                  fontWeight: "bold"
                }}
              >
                Add All
              </button>
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
                <div style={{ display: "grid", gridTemplateColumns: "220px 130px 1fr 120px 90px", gap: "1rem" }}>
                  <span>Wallet Address</span>
                  <span>Label</span>
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
                  <div style={{ display: "grid", gridTemplateColumns: "220px 130px 1fr 120px 90px", gap: "1rem", alignItems: "center" }}>
                    <code style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
                      {entry.wallet}
                    </code>
                    <span style={{ fontSize: "0.9rem" }}>
                      {entry.label || <em style={{ color: "var(--text-faint)" }}>—</em>}
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
                    <li>{archivePreview?.predictions || 0} predictions</li>
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

      {/* Deploy CritCoin Tab */}
      {activeTab === "deploy" && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2>🚀 Deploy CritCoin</h2>
          <div style={{ 
            backgroundColor: "var(--tint-warning)", 
            border: "1px solid var(--status-warning)", 
            borderRadius: "8px", 
            padding: "2rem", 
            maxWidth: "600px", 
            margin: "0 auto 2rem"
          }}>
            <h3>⚠️ Warning</h3>
            <p>This credits <strong>10,000 CritCoin</strong> in the ledger <em>and</em> transfers real tokens on Sepolia to all active profiles <strong>(excluding your admin profile)</strong>.</p>
            <p>Total active profiles: <strong>{dashboard.profiles?.total || 0}</strong></p>
            <p>Recipients (excluding admin): <strong>{dashboard.profiles?.totalExcludingAdmin || 0}</strong></p>
            <p>Total CritCoin to be deployed: <strong>{(dashboard.profiles?.totalExcludingAdmin || 0) * 10000} CC</strong></p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Your wallet is checked for enough CritCoin and Sepolia ETH before anything is written.
              Re-running is safe: confirmed students are skipped, failed ones retried, and nobody is credited twice.
            </p>

            {!showDeployConfirm ? (
              <button
                onClick={() => handleDeployCritCoin(false)}
                style={{
                  padding: "1rem 2rem",
                  backgroundColor: "var(--status-warning)",
                  color: "var(--text-body)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: "bold"
                }}
              >
                🚀 Deploy CritCoin
              </button>
            ) : (
              <div>
                <h4 style={{ color: "var(--status-negative)" }}>Are you absolutely sure?</h4>
                <p>This action cannot be undone!</p>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Each transfer requires a blockchain transaction. You will need to confirm each in your wallet.
                </p>
                {deployLoading && deployProgress.total > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{
                      width: "100%",
                      height: "20px",
                      backgroundColor: "var(--surface-card-border)",
                      borderRadius: "10px",
                      overflow: "hidden",
                      marginBottom: "0.5rem"
                    }}>
                      <div style={{
                        width: `${(deployProgress.current / deployProgress.total) * 100}%`,
                        height: "100%",
                        backgroundColor: deployProgress.failed.length > 0 ? "var(--status-warning)" : "var(--status-positive)",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                    <p style={{ margin: 0 }}>
                      Progress: {deployProgress.current} / {deployProgress.total}
                      {deployProgress.failed.length > 0 && (
                        <span style={{ color: "var(--status-negative)" }}> ({deployProgress.failed.length} failed)</span>
                      )}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleDeployCritCoin(false)}
                  disabled={deployLoading}
                  style={{
                    padding: "1rem 2rem",
                    backgroundColor: "var(--status-negative)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: deployLoading ? "not-allowed" : "pointer",
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    marginRight: "1rem",
                    opacity: deployLoading ? 0.6 : 1
                  }}
                >
                  {deployLoading
                    ? `Deploying... (${deployProgress.current}/${deployProgress.total})`
                    : "✅ Yes, Deploy Now"}
                </button>
                <button
                  onClick={() => setShowDeployConfirm(false)}
                  disabled={deployLoading}
                  style={{
                    padding: "1rem 2rem",
                    backgroundColor: "var(--text-muted)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: deployLoading ? "not-allowed" : "pointer",
                    fontSize: "1.1rem",
                    opacity: deployLoading ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Per-student status for the current/most recent deploy */}
          {latestDeploy && (
            <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "left" }}>
              <h3>
                Most recent deploy
                <span style={{ fontWeight: "normal", fontSize: "0.9rem", color: "var(--text-muted)", marginLeft: "0.75rem" }}>
                  {new Date(latestDeploy.createdAt).toLocaleString()} · {latestDeploy.amountPerStudent} CC each
                </span>
              </h3>

              <p style={{ fontSize: "0.9rem" }}>
                <strong>{latestDeploy.summary.confirmed}</strong> confirmed on-chain ·{" "}
                <strong style={{ color: latestDeploy.summary.failed ? "var(--status-negative)" : "inherit" }}>
                  {latestDeploy.summary.failed}
                </strong>{" "}
                failed ·{" "}
                <strong>{latestDeploy.summary.awaiting}</strong> awaiting ·{" "}
                {latestDeploy.summary.total} total
              </p>

              {latestDeploy.status === 'in_progress' && (
                <button
                  onClick={() => handleDeployCritCoin(true)}
                  disabled={deployLoading}
                  style={{
                    padding: "0.6rem 1.2rem",
                    backgroundColor: "var(--primary-blue)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: deployLoading ? "not-allowed" : "pointer",
                    marginBottom: "1rem",
                    opacity: deployLoading ? 0.6 : 1
                  }}
                >
                  ▶ Resume deploy ({latestDeploy.summary.awaiting + latestDeploy.summary.failed} remaining)
                </button>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--surface-muted)", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Student</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Wallet</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Status</th>
                      <th style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestDeploy.rows.map(row => (
                      <tr key={row.wallet}>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>{row.name || "—"}</td>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>
                          <AddressLink address={row.wallet} />
                        </td>
                        <td style={{
                          padding: "0.5rem",
                          border: "1px solid var(--surface-card-border)",
                          color: DEPLOY_STATUS_COLORS[row.status] || "inherit",
                          fontWeight: "bold"
                        }}>
                          {DEPLOY_STATUS_LABELS[row.status] || row.status}
                        </td>
                        <td style={{ padding: "0.5rem", border: "1px solid var(--surface-card-border)" }}>
                          {row.status === 'chain_failed'
                            ? <span style={{ color: "var(--status-negative)", fontSize: "0.85rem" }}>{row.error}</span>
                            : <TxLink hash={row.txHash} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Tab - read-only diagnostic */}
      {activeTab === "reconcile" && (
        <div>
          <h2>Reconciliation</h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "800px" }}>
            The database ledger is authoritative for every balance in the app. This compares it against
            live on-chain balances so drift is visible. It is read-only — nothing here writes to the
            database or sends a transaction, and drift is never corrected automatically.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
            <button onClick={fetchReconcile} disabled={reconcileLoading}>
              {reconcileLoading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={handleSyncGrants}
              style={{
                backgroundColor: "var(--primary-blue)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "0.5rem 1rem",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Sync admin grants
            </button>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Absorbs on-chain transfers <em>from the deployer wallet</em> into the ledger (a deliberate
              write; only deployer-sourced transfers are recorded).
            </span>
          </div>

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