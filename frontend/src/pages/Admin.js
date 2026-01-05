// src/pages/Admin.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

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
  
  // Bounty form
  const [bountyForm, setBountyForm] = useState({ title: "", description: "", reward: "" });
  const [editingBounty, setEditingBounty] = useState(null);
  
  // Whitelist form
  const [whitelistForm, setWhitelistForm] = useState({ wallet: "", notes: "" });

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
      if (activeTab === "semester") fetchSemesterArchives();
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

  const handleToggleWhitelistMode = async () => {
    try {
      const res = await postWithSignature(`${API.admin}/settings`, 'admin_post_settings', {
        key: "whitelistMode",
        value: !settings.whitelistMode
      });

      if (res.ok) {
        alert(`Whitelist mode ${!settings.whitelistMode ? 'enabled' : 'disabled'} successfully`);
        fetchSettings();
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Toggle whitelist mode error:", error);
        alert("Error: " + (error.error || error));
      }
    } catch (err) {
      console.error("Toggle whitelist mode error:", err);
      alert("Error toggling whitelist mode. Please check your wallet connection.");
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
        notes: whitelistForm.notes
      });

      if (res.ok) {
        alert("Wallet added to whitelist successfully");
        setWhitelistForm({ wallet: "", notes: "" });
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

  const handleDeployCritCoin = async () => {
    if (!showDeployConfirm) {
      setShowDeployConfirm(true);
      return;
    }

    setDeployLoading(true);
    try {
      const res = await postWithSignature(`${API.admin}/deploy-critcoin`, 'admin_post_deploy_critcoin', {
        confirmed: true
      });

      if (res.ok) {
        const result = await res.json();
        alert(`CritCoin deployed successfully!\n${result.recipients} profiles received ${result.amountPerProfile} CritCoin each.\nTotal deployed: ${result.totalDeployed} CritCoin`);
        setShowDeployConfirm(false);
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Deploy CritCoin error:", error);
        alert("Deploy failed: " + (error.error || error));
      }
    } catch (err) {
      console.error("Deploy CritCoin error:", err);
      alert("Error deploying CritCoin. Please check your wallet connection.");
    } finally {
      setDeployLoading(false);
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
        <div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
          <p>Debug info:</p>
          <p>Connected (lowercase): {wallet?.toLowerCase()}</p>
          <p>Expected (lowercase): {ADMIN_WALLET}</p>
        </div>
        <Link to="/">Go to Home</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>🛡️ Admin Panel</h1>
      
      <p><strong>Admin:</strong> {wallet}</p>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "2rem" }}>
        {["dashboard", "profiles", "posts", "projects", "bounties", "whitelist", "semester", "deploy"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              margin: "0 0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: activeTab === tab ? "#007bff" : "#f8f9fa",
              color: activeTab === tab ? "white" : "black",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
              textTransform: "capitalize"
            }}
          >
{tab === "deploy" ? "Deploy CritCoin" : tab === "whitelist" ? "Whitelist" : tab === "semester" ? "Semester Archive" : tab}
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
            <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "8px" }}>
              <h4>Profiles</h4>
              <p>Active: {dashboard.profiles?.total || 0}</p>
              <p>Archived: {dashboard.profiles?.archived || 0}</p>
            </div>
            <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "8px" }}>
              <h4>Posts</h4>
              <p>Total: {dashboard.posts?.total || 0}</p>
              <p>Hidden: {dashboard.posts?.hidden || 0}</p>
            </div>
            <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "8px" }}>
              <h4>Bounties</h4>
              <p>Total: {dashboard.bounties?.total || 0}</p>
              <p>Active: {dashboard.bounties?.active || 0}</p>
            </div>
            <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "8px" }}>
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
            <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid #ddd",
                backgroundColor: "#f8f9fa",
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
                    borderBottom: index < profiles.length - 1 ? "1px solid #e9ecef" : "none",
                    backgroundColor: profile.archived ? "#fff3cd" : "white"
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
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>{profile.starSign}</div>
                      </div>
                    </div>
                    <code style={{ fontSize: "0.8rem" }}>{profile.wallet.slice(0, 10)}...</code>
                    <span style={{ 
                      color: profile.archived ? "#856404" : "#155724",
                      fontWeight: "bold"
                    }}>
                      {profile.archived ? "Archived" : "Active"}
                    </span>
                    <button
                      onClick={() => handleArchiveProfile(profile.wallet, !profile.archived)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: profile.archived ? "#28a745" : "#dc3545",
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
            <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid #ddd",
                backgroundColor: "#f8f9fa",
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
                    borderBottom: index < posts.length - 1 ? "1px solid #e9ecef" : "none",
                    backgroundColor: post.hidden ? "#f8d7da" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 100px", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <strong>{post.authorName}</strong>
                      <div style={{ fontSize: "0.7rem", color: "#666" }}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ 
                      maxHeight: "60px", 
                      overflow: "hidden",
                      textDecoration: post.hidden ? "line-through" : "none",
                      color: post.hidden ? "#721c24" : "inherit"
                    }}>
                      {post.content}
                    </div>
                    <span style={{ 
                      color: post.hidden ? "#721c24" : "#155724",
                      fontWeight: "bold"
                    }}>
                      {post.hidden ? "Hidden" : "Visible"}
                    </span>
                    <button
                      onClick={() => handleHidePost(post._id, !post.hidden)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: post.hidden ? "#28a745" : "#dc3545",
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
            <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid #ddd",
                backgroundColor: "#f8f9fa",
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
                    borderBottom: index < projects.length - 1 ? "1px solid #e9ecef" : "none",
                    backgroundColor: project.archived ? "#fff3cd" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 100px 120px", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <strong>{project.authorName}</strong>
                      <div style={{ fontSize: "0.7rem", color: "#666" }}>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ 
                      textDecoration: project.archived ? "line-through" : "none",
                      color: project.archived ? "#856404" : "inherit"
                    }}>
                      <div><strong>{project.title}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>{project.description}</div>
                      <div style={{ fontSize: "0.7rem", color: "#28a745", marginTop: "0.25rem" }}>
                        {project.totalReceived} CC received
                      </div>
                    </div>
                    <span style={{ fontWeight: "bold" }}>
                      Project {project.projectNumber}
                    </span>
                    <span style={{ 
                      color: project.archived ? "#856404" : "#155724",
                      fontWeight: "bold"
                    }}>
                      {project.archived ? "Archived" : "Active"}
                    </span>
                    <button
                      onClick={() => handleArchiveProject(project._id, !project.archived)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: project.archived ? "#28a745" : "#dc3545",
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
            backgroundColor: "#f8f9fa", 
            padding: "1rem", 
            borderRadius: "8px", 
            marginBottom: "2rem",
            border: "1px solid #dee2e6"
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
                  backgroundColor: "#007bff",
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
                    backgroundColor: "#6c757d",
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
            <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid #ddd",
                backgroundColor: "#f8f9fa",
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
                    borderBottom: index < bounties.length - 1 ? "1px solid #e9ecef" : "none",
                    backgroundColor: bounty.crossedOut ? "#f8d7da" : "white"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 200px", gap: "1rem", alignItems: "center" }}>
                    <div style={{ 
                      textDecoration: bounty.crossedOut ? "line-through" : "none",
                      color: bounty.crossedOut ? "#721c24" : "inherit"
                    }}>
                      <div><strong>{bounty.title}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>{bounty.description}</div>
                    </div>
                    <span style={{ fontWeight: "bold", color: "#28a745" }}>
                      {bounty.reward} CC
                    </span>
                    <span style={{ 
                      color: bounty.crossedOut ? "#721c24" : "#155724",
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
                          backgroundColor: "#007bff",
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
                          backgroundColor: bounty.crossedOut ? "#28a745" : "#dc3545",
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
                          backgroundColor: "#6c757d",
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

      {/* Whitelist Tab */}
      {activeTab === "whitelist" && (
        <div>
          <h2>🔐 Whitelist Management</h2>
          {console.log("Rendering whitelist tab. Settings:", settings, "Whitelist:", whitelist)}
          
          {/* Whitelist Mode Toggle */}
          <div style={{ 
            backgroundColor: settings.whitelistMode ? "#d1ecf1" : "#fff3cd", 
            padding: "1rem", 
            borderRadius: "8px", 
            marginBottom: "2rem",
            border: `1px solid ${settings.whitelistMode ? "#bee5eb" : "#ffeaa7"}`
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ margin: "0 0 0.5rem 0" }}>
                  {settings.whitelistMode ? "🔒 Whitelist Mode: ENABLED" : "🔓 Whitelist Mode: DISABLED"}
                </h4>
                <p style={{ margin: 0, color: "#666" }}>
                  {settings.whitelistMode 
                    ? "Only whitelisted wallets can create new profiles. Existing profiles can still access the platform."
                    : "Anyone with ≥1 CritCoin can create profiles. Perfect for first day of class."
                  }
                </p>
              </div>
              <button
                onClick={handleToggleWhitelistMode}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: settings.whitelistMode ? "#dc3545" : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                {settings.whitelistMode ? "Disable Whitelist" : "Enable Whitelist"}
              </button>
            </div>
          </div>

          {/* Add to Whitelist Form */}
          <div style={{ 
            backgroundColor: "#f8f9fa", 
            padding: "1rem", 
            borderRadius: "8px", 
            marginBottom: "2rem",
            border: "1px solid #dee2e6"
          }}>
            <h4>Add Wallet to Whitelist</h4>
            <form onSubmit={handleAddToWhitelist}>
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr auto", gap: "1rem", alignItems: "end" }}>
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
                      border: "1px solid #ced4da"
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
                      border: "1px solid #ced4da"
                    }}
                  />
                </div>
                <button 
                  type="submit"
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#007bff",
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
              backgroundColor: "#f8f9fa", 
              padding: "2rem", 
              textAlign: "center", 
              borderRadius: "8px",
              border: "1px solid #dee2e6"
            }}>
              <p style={{ margin: 0, color: "#666" }}>No wallets in whitelist yet</p>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{ 
                padding: "1rem", 
                borderBottom: "1px solid #ddd",
                backgroundColor: "#f8f9fa",
                fontWeight: "bold"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "250px 1fr 150px 100px", gap: "1rem" }}>
                  <span>Wallet Address</span>
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
                    borderBottom: index < whitelist.length - 1 ? "1px solid #e9ecef" : "none"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "250px 1fr 150px 100px", gap: "1rem", alignItems: "center" }}>
                    <code style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
                      {entry.wallet}
                    </code>
                    <span style={{ fontSize: "0.9rem" }}>
                      {entry.notes || <em style={{ color: "#999" }}>No notes</em>}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#666" }}>
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleRemoveFromWhitelist(entry.wallet)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#dc3545",
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
          <p style={{ color: "#666", marginBottom: "2rem" }}>
            Archive the current semester's data before starting a new class. This preserves all profiles, projects, posts, and transactions for future reference.
          </p>

          {/* Create New Archive */}
          <div style={{
            backgroundColor: "#e7f3ff",
            border: "1px solid #b3d9ff",
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
                    border: "1px solid #ced4da"
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
                    border: "1px solid #ced4da"
                  }}
                />
              </div>

              {!showArchiveConfirm ? (
                <button
                  type="submit"
                  disabled={archiveLoading || !archiveForm.name.trim()}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: editingArchive ? "#007bff" : "#28a745",
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
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffc107",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginTop: "1rem"
                }}>
                  <h4 style={{ color: "#856404", marginTop: 0 }}>⚠️ Confirm Archive</h4>
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
                      backgroundColor: "#28a745",
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
                      backgroundColor: "#6c757d",
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
                    backgroundColor: "#6c757d",
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
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem"
          }}>
            <h3 style={{ marginTop: 0, color: "#721c24" }}>🗑️ Clear Current Site Data</h3>
            <p style={{ color: "#721c24" }}>
              After archiving, you can clear the current site data to start fresh for a new semester.
              <br /><strong>Warning:</strong> This will permanently delete all current profiles (except admin), projects, posts, comments, transactions, and bounties.
            </p>

            {!showClearConfirm ? (
              <button
                onClick={handleClearSiteData}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#dc3545",
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
                backgroundColor: "#fff",
                border: "2px solid #dc3545",
                borderRadius: "8px",
                padding: "1rem",
                marginTop: "1rem"
              }}>
                <h4 style={{ color: "#dc3545", marginTop: 0 }}>⚠️ DANGER ZONE</h4>
                <p><strong>Are you absolutely sure?</strong> This action cannot be undone!</p>
                <p>Make sure you have archived the current semester first.</p>
                <button
                  onClick={handleClearSiteData}
                  disabled={archiveLoading}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#dc3545",
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
                    backgroundColor: "#6c757d",
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
              backgroundColor: "#f8f9fa",
              padding: "2rem",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px solid #dee2e6"
            }}>
              <p style={{ margin: 0, color: "#666" }}>No semester archives yet</p>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{
                padding: "1rem",
                borderBottom: "1px solid #ddd",
                backgroundColor: "#f8f9fa",
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
                    borderBottom: index < semesterArchives.length - 1 ? "1px solid #e9ecef" : "none"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 150px 200px", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{archive.name}</div>
                      {archive.description && (
                        <div style={{ fontSize: "0.9rem", color: "#666" }}>{archive.description}</div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      <div>{archive.stats?.totalProfiles || 0} profiles</div>
                      <div>{archive.stats?.totalProjects || 0} projects</div>
                      <div>{archive.stats?.totalPosts || 0} posts</div>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      {new Date(archive.archivedAt).toLocaleDateString()}
                    </div>
                    <div>
                      <Link
                        to={`/archive/${archive._id}`}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "#007bff",
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
                          backgroundColor: "#ffc107",
                          color: "#212529",
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
                          backgroundColor: "#dc3545",
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
            backgroundColor: "#fff3cd", 
            border: "1px solid #ffeaa7", 
            borderRadius: "8px", 
            padding: "2rem", 
            maxWidth: "600px", 
            margin: "0 auto 2rem"
          }}>
            <h3>⚠️ Warning</h3>
            <p>This action will send <strong>10,000 CritCoin</strong> to all active profiles <strong>(excluding your admin profile)</strong>.</p>
            <p>Total active profiles: <strong>{dashboard.profiles?.total || 0}</strong></p>
            <p>Recipients (excluding admin): <strong>{dashboard.profiles?.totalExcludingAdmin || 0}</strong></p>
            <p>Total CritCoin to be deployed: <strong>{(dashboard.profiles?.totalExcludingAdmin || 0) * 10000} CC</strong></p>
            
            {!showDeployConfirm ? (
              <button
                onClick={handleDeployCritCoin}
                style={{
                  padding: "1rem 2rem",
                  backgroundColor: "#ffc107",
                  color: "#212529",
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
                <h4 style={{ color: "#d73527" }}>Are you absolutely sure?</h4>
                <p>This action cannot be undone!</p>
                <button
                  onClick={handleDeployCritCoin}
                  disabled={deployLoading}
                  style={{
                    padding: "1rem 2rem",
                    backgroundColor: "#dc3545",
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
                  {deployLoading ? "Deploying..." : "✅ Yes, Deploy Now"}
                </button>
                <button
                  onClick={() => setShowDeployConfirm(false)}
                  disabled={deployLoading}
                  style={{
                    padding: "1rem 2rem",
                    backgroundColor: "#6c757d",
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
        </div>
      )}
    </div>
  );
}