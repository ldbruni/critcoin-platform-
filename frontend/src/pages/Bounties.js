// src/pages/Bounties.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

const API = {
  bounties: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/admin/public/bounties` : "http://localhost:3001/api/admin/public/bounties",
  profiles: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/profiles` : "http://localhost:3001/api/profiles"
};

export default function Bounties() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.ethereum) connectWallet();
    fetchBounties();
  }, []);

  const connectWallet = async () => {
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(addr);

      // Get balance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(deployed.address, deployed.abi, provider);
      const bal = await contract.balanceOf(addr);
      setBalance(Number(bal.toString()));

      // Load user's profile
      try {
        const res = await fetch(`${API.profiles}/${addr}`);
        if (res.ok) {
          const prof = await res.json();
          setProfile(prof);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const fetchBounties = async () => {
    setLoading(true);
    try {
      console.log("🎯 Fetching bounties from:", API.bounties);
      const res = await fetch(API.bounties);
      console.log("🎯 Response status:", res.status);
      
      if (res.ok) {
        const text = await res.text();
        console.log("🎯 Response text:", text.substring(0, 200));
        
        try {
          const data = JSON.parse(text);
          setBounties(data);
        } catch (parseErr) {
          console.error("❌ JSON parse error:", parseErr);
          console.error("❌ Response was not JSON:", text);
        }
      } else {
        const errorText = await res.text();
        console.error("❌ Failed to fetch bounties. Status:", res.status);
        console.error("❌ Error response:", errorText);
      }
    } catch (err) {
      console.error("❌ Network error fetching bounties:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': '#28a745',
      'completed': '#007bff',
      'cancelled': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'active': '🎯',
      'completed': '✅',
      'cancelled': '❌'
    };
    return icons[status] || '📝';
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>🎯 Active Bounties</h1>
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: "0.5rem", 
        marginBottom: "1rem",
        fontSize: "1rem"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.5rem",
          width: "100%",
          justifyContent: "center"
        }}>
          <Link to="/profiles" style={{ textDecoration: "none" }}>👤 Profiles</Link>
          <span>|</span>
          <Link to="/projects" style={{ textDecoration: "none" }}>🎨 Projects</Link>
          <span>|</span>
          <Link to="/explorer" style={{ textDecoration: "none" }}>🔍 Explorer</Link>
        </div>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          width: "100%",
          justifyContent: "center"
        }}>
          <Link to="/forum" style={{ textDecoration: "none" }}>💬 Forum</Link>
        </div>
      </div>

      {!wallet ? (
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "2rem", 
          borderRadius: "8px", 
          textAlign: "center",
          marginBottom: "2rem"
        }}>
          <h3>Connect Your Wallet</h3>
          <p>Connect your wallet to view your profile and participate in bounties.</p>
          <button 
            onClick={connectWallet}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "1rem", 
          borderRadius: "8px", 
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <strong>{profile?.name || wallet}</strong>
            <span style={{ marginLeft: "1rem", color: "#666" }}>
              Balance: {balance} CritCoin
            </span>
          </div>
          {!profile && (
            <Link 
              to="/profiles"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#28a745",
                color: "white",
                textDecoration: "none",
                borderRadius: "0.25rem",
                fontSize: "0.9rem"
              }}
            >
              Create Profile
            </Link>
          )}
        </div>
      )}

      {/* Bounties List */}
      <div>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "1rem" 
        }}>
          <h2>Available Bounties</h2>
          <span style={{ color: "#6c757d" }}>
            {bounties.length} active bounties
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <p>Loading bounties...</p>
          </div>
        ) : bounties.length === 0 ? (
          <div style={{
            backgroundColor: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            padding: "3rem",
            textAlign: "center"
          }}>
            <h3 style={{ color: "#6c757d" }}>No Active Bounties</h3>
            <p style={{ color: "#6c757d" }}>
              Check back later for new bounties from your instructor!
            </p>
          </div>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", 
            gap: "1.5rem" 
          }}>
            {bounties.map((bounty) => (
              <div 
                key={bounty._id}
                style={{
                  backgroundColor: "white",
                  border: "1px solid #dee2e6",
                  borderRadius: "8px",
                  padding: "1.5rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "transform 0.2s ease-in-out",
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                {/* Bounty Header */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "flex-start",
                  marginBottom: "1rem"
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: "0 0 0.5rem 0", 
                      color: "#333",
                      fontSize: "1.25rem"
                    }}>
                      {bounty.title}
                    </h3>
                    <div style={{ 
                      fontSize: "0.85rem", 
                      color: "#6c757d",
                      marginBottom: "0.5rem"
                    }}>
                      Created {formatDate(bounty.createdAt)}
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "flex-end",
                    marginLeft: "1rem"
                  }}>
                    <div style={{
                      backgroundColor: getStatusColor(bounty.status),
                      color: "white",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "1rem",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      marginBottom: "0.5rem"
                    }}>
                      {getStatusIcon(bounty.status)} {bounty.status.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Bounty Description */}
                <div style={{ 
                  marginBottom: "1.5rem",
                  lineHeight: "1.5"
                }}>
                  <p style={{ 
                    color: "#555", 
                    margin: 0,
                    fontSize: "0.95rem"
                  }}>
                    {bounty.description}
                  </p>
                </div>

                {/* Bounty Reward */}
                <div style={{
                  borderTop: "1px solid #e9ecef",
                  paddingTop: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <span style={{ 
                      color: "#6c757d", 
                      fontSize: "0.9rem",
                      fontWeight: "500"
                    }}>
                      Reward:
                    </span>
                  </div>
                  <div style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "#28a745",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    💰 {bounty.reward} CC
                  </div>
                </div>

                {/* Completion Status */}
                {bounty.completedBy && (
                  <div style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#d4edda",
                    border: "1px solid #c3e6cb",
                    borderRadius: "0.375rem"
                  }}>
                    <small style={{ color: "#155724", fontWeight: "500" }}>
                      ✅ Completed by {bounty.completedBy}
                      {bounty.completedAt && ` on ${formatDate(bounty.completedAt)}`}
                    </small>
                  </div>
                )}

                {/* Action Hint */}
                {bounty.status === 'active' && !bounty.completedBy && wallet && profile && (
                  <div style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fff3cd",
                    border: "1px solid #ffeaa7",
                    borderRadius: "0.375rem"
                  }}>
                    <small style={{ color: "#856404" }}>
                      💡 Contact your instructor when you complete this bounty to claim the reward!
                    </small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Information Footer */}
      <div style={{
        marginTop: "3rem",
        padding: "1.5rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #dee2e6"
      }}>
        <h4 style={{ marginTop: 0, color: "#495057" }}>📋 How Bounties Work</h4>
        <ul style={{ color: "#6c757d", paddingLeft: "1.5rem" }}>
          <li>Bounties are special tasks created by your instructor</li>
          <li>Complete the task described in the bounty</li>
          <li>Contact your instructor to verify completion and claim your CritCoin reward</li>
          <li>Make sure you have a profile created to participate</li>
        </ul>
      </div>
    </div>
  );
}