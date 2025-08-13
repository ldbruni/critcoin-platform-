// src/pages/Admin.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

const API = {
  admin: "http://localhost:3001/api/admin",
  profiles: "http://localhost:3001/api/profiles"
};

// Replace with your actual admin wallet address
const ADMIN_WALLET = process.env.REACT_APP_ADMIN_WALLET?.toLowerCase() || "0xc69c361d300aeaad0aee95bd1c753e62298f92e9";

export default function Admin() {
  const [wallet, setWallet] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Deploy CritCoin confirmation
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  
  // Bounty form
  const [bountyForm, setBountyForm] = useState({ title: "", description: "", reward: "" });
  const [editingBounty, setEditingBounty] = useState(null);

  useEffect(() => {
    if (window.ethereum) connectWallet();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboard();
      if (activeTab === "profiles") fetchProfiles();
      if (activeTab === "posts") fetchPosts();
      if (activeTab === "bounties") fetchBounties();
    }
  }, [isAdmin, activeTab]);

  const connectWallet = async () => {
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(addr);
      setIsAdmin(addr.toLowerCase() === ADMIN_WALLET);
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API.admin}/dashboard/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API.admin}/profiles/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      console.error("Profiles fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API.admin}/posts/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error("Posts fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBounties = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API.admin}/bounties/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        setBounties(data);
      }
    } catch (err) {
      console.error("Bounties fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveProfile = async (profileWallet, archive) => {
    try {
      const res = await fetch(`${API.admin}/profiles/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: wallet,
          wallet: profileWallet,
          archive
        })
      });

      if (res.ok) {
        alert(`Profile ${archive ? 'archived' : 'unarchived'} successfully`);
        fetchProfiles();
        fetchDashboard();
      } else {
        const errorText = await res.text();
        alert("Error: " + errorText);
      }
    } catch (err) {
      console.error("Archive profile error:", err);
      alert("Error archiving profile");
    }
  };

  const handleHidePost = async (postId, hide) => {
    try {
      const res = await fetch(`${API.admin}/posts/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: wallet,
          postId,
          hide
        })
      });

      if (res.ok) {
        alert(`Post ${hide ? 'hidden' : 'unhidden'} successfully`);
        fetchPosts();
        fetchDashboard();
      } else {
        const errorText = await res.text();
        alert("Error: " + errorText);
      }
    } catch (err) {
      console.error("Hide post error:", err);
      alert("Error hiding post");
    }
  };

  const handleBountySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const endpoint = editingBounty 
        ? `${API.admin}/bounties/update`
        : `${API.admin}/bounties`;
      
      const payload = {
        adminWallet: wallet,
        title: bountyForm.title,
        description: bountyForm.description,
        reward: Number(bountyForm.reward)
      };

      if (editingBounty) {
        payload.bountyId = editingBounty._id;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(`Bounty ${editingBounty ? 'updated' : 'created'} successfully`);
        setBountyForm({ title: "", description: "", reward: "" });
        setEditingBounty(null);
        fetchBounties();
        fetchDashboard();
      } else {
        const errorText = await res.text();
        alert("Error: " + errorText);
      }
    } catch (err) {
      console.error("Bounty submit error:", err);
      alert("Error with bounty");
    }
  };

  const handleCrossOutBounty = async (bountyId, crossOut) => {
    try {
      const res = await fetch(`${API.admin}/bounties/cross-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: wallet,
          bountyId,
          crossOut
        })
      });

      if (res.ok) {
        alert(`Bounty ${crossOut ? 'crossed out' : 'restored'} successfully`);
        fetchBounties();
      } else {
        const errorText = await res.text();
        alert("Error: " + errorText);
      }
    } catch (err) {
      console.error("Cross out bounty error:", err);
      alert("Error crossing out bounty");
    }
  };

  const handleDeployCritCoin = async () => {
    if (!showDeployConfirm) {
      setShowDeployConfirm(true);
      return;
    }

    setDeployLoading(true);
    try {
      const res = await fetch(`${API.admin}/deploy-critcoin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: wallet,
          confirmed: true
        })
      });

      if (res.ok) {
        const result = await res.json();
        alert(`CritCoin deployed successfully!\n${result.recipients} profiles received ${result.amountPerProfile} CritCoin each.\nTotal deployed: ${result.totalDeployed} CritCoin`);
        setShowDeployConfirm(false);
      } else {
        const errorText = await res.text();
        alert("Deploy failed: " + errorText);
      }
    } catch (err) {
      console.error("Deploy CritCoin error:", err);
      alert("Error deploying CritCoin");
    } finally {
      setDeployLoading(false);
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
      <p>
        <Link to="/profiles">👤 Profiles</Link> | 
        <Link to="/projects" style={{ margin: "0 1rem" }}>🎨 Projects</Link> | 
        <Link to="/explorer" style={{ marginRight: "1rem" }}>🔍 Explorer</Link> | 
        <Link to="/forum">💬 Forum</Link>
      </p>
      
      <p><strong>Admin:</strong> {wallet}</p>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "2rem" }}>
        {["dashboard", "profiles", "posts", "bounties", "deploy"].map(tab => (
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
            {tab === "deploy" ? "Deploy CritCoin" : tab}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 150px", gap: "1rem" }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 150px", gap: "1rem", alignItems: "center" }}>
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
                          fontSize: "0.7rem"
                        }}
                      >
                        {bounty.crossedOut ? "Restore" : "Cross Out"}
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