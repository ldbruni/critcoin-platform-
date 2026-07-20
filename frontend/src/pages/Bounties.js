// src/pages/Bounties.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBalance } from "../utils/balance";

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

      // Balance comes from the database ledger, not the chain.
      setBalance(await fetchBalance(addr));

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
      'active': 'var(--status-positive)',
      'completed': 'var(--primary-blue)',
      'cancelled': 'var(--status-negative)'
    };
    return colors[status] || 'var(--text-muted)';
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
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div className="v2-masthead">
        <div className="v2-kicker">CritCoin · Bounties</div>
        <h1 className="gothic-title gothic-text">Active Bounties</h1>
      </div>

      {!wallet ? (
        <div style={{ 
          backgroundColor: "var(--surface-muted)", 
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
              backgroundColor: "var(--primary-blue)",
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
          backgroundColor: "var(--surface-muted)", 
          padding: "1rem", 
          borderRadius: "8px", 
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <strong>{profile?.name || wallet}</strong>
            <span style={{ marginLeft: "1rem", color: "var(--text-muted)" }}>
              Balance: {balance} CritCoin
            </span>
          </div>
          {!profile && (
            <Link 
              to="/profiles"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--status-positive)",
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
          <span style={{ color: "var(--text-muted)" }}>
            {bounties.length} active bounties
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <p>Loading bounties...</p>
          </div>
        ) : bounties.length === 0 ? (
          <div style={{
            backgroundColor: "var(--surface-muted)",
            border: "1px solid var(--surface-card-border)",
            borderRadius: "8px",
            padding: "3rem",
            textAlign: "center"
          }}>
            <h3 style={{ color: "var(--text-muted)" }}>No Active Bounties</h3>
            <p style={{ color: "var(--text-muted)" }}>
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
                  backgroundColor: "var(--surface-card)",
                  border: "1px solid var(--surface-card-border)",
                  borderRadius: "3px",
                  padding: "1.5rem",
                  transition: "border-color 0.2s ease-in-out",
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary-blue)"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--surface-card-border)"}
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
                      color: "var(--text-body)",
                      fontSize: "1.25rem"
                    }}>
                      {bounty.title}
                    </h3>
                    <div style={{ 
                      fontSize: "0.85rem", 
                      color: "var(--text-muted)",
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
                    color: "var(--text-muted)", 
                    margin: 0,
                    fontSize: "0.95rem"
                  }}>
                    {bounty.description}
                  </p>
                </div>

                {/* Bounty Reward */}
                <div style={{
                  borderTop: "1px solid var(--surface-card-border)",
                  paddingTop: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <span style={{ 
                      color: "var(--text-muted)", 
                      fontSize: "0.9rem",
                      fontWeight: "500"
                    }}>
                      Reward:
                    </span>
                  </div>
                  <div style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "var(--status-positive)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}>
                    💰 <span className="ledger-num">{bounty.reward}</span> CC
                  </div>
                </div>

                {/* Completion Status */}
                {bounty.completedBy && (
                  <div style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "var(--tint-positive)",
                    border: "1px solid var(--status-positive)",
                    borderRadius: "0.375rem"
                  }}>
                    <small style={{ color: "var(--status-positive)", fontWeight: "500" }}>
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
                    backgroundColor: "var(--tint-warning)",
                    border: "1px solid var(--status-warning)",
                    borderRadius: "0.375rem"
                  }}>
                    <small style={{ color: "var(--status-warning)" }}>
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
        backgroundColor: "var(--surface-muted)",
        borderRadius: "8px",
        border: "1px solid var(--surface-card-border)"
      }}>
        <h4 style={{ marginTop: 0, color: "var(--text-muted)" }}>📋 How Bounties Work</h4>
        <ul style={{ color: "var(--text-muted)", paddingLeft: "1.5rem" }}>
          <li>Bounties are special tasks created by your instructor</li>
          <li>Complete the task described in the bounty</li>
          <li>Contact your instructor to verify completion and claim your CritCoin reward</li>
          <li>Make sure you have a profile created to participate</li>
        </ul>
      </div>
    </div>
  );
}