// src/pages/ForumPage.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";
// import { UpvoteEmoji, DownvoteEmoji } from "../components/Emoji";

export default function ForumPage() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");

  const API = {
    profiles: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/profiles` : "http://localhost:3001/api/profiles",
    posts: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/posts` : "http://localhost:3001/api/posts"
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      // 1) Load posts
      const res = await fetch(API.posts);
      if (!res.ok) {
        const t = await res.text();
        console.error("Fetch posts failed:", t);
        return;
      }
      const data = await res.json(); // array of { _id, authorWallet, content, createdAt, upvotes, downvotes }

      // 2) Load all profiles (non-archived) — backend route: GET /api/profiles
      let profileMap = {};
      let profiles = [];
      try {
        const profRes = await fetch(API.profiles);
        if (profRes.ok) {
          profiles = await profRes.json(); // [{ wallet, name, photo, ... }]
          profileMap = Object.fromEntries(
            profiles.map(p => [p.wallet.toLowerCase(), p.name])
          );
        } else {
          const t = await profRes.text();
          console.warn("Profile list fetch not OK:", t);
        }
      } catch (err) {
        console.warn("Profile list fetch error (will fallback to wallet):", err);
      }

      // 3) Enrich posts with profile info including photos
      const enriched = data.map(post => {
        const w = post.authorWallet?.toLowerCase();
        const profileData = w && profiles.find(p => p.wallet === w);
        return {
          ...post,
          authorName: (w && profileMap[w]) || post.authorWallet || "Unknown",
          authorPhoto: profileData?.photo
        };
      });

      setPosts(enriched);
    } catch (err) {
      console.error("Network error in fetchPosts:", err);
    }
  };

  const connectWallet = async () => {
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(addr);

      // Show balance from ERC20 (no decimals display)
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(deployed.address, deployed.abi, provider);
      const bal = await contract.balanceOf(addr);
      setBalance(Number(bal.toString()));

      // Load user’s profile by wallet (OK if 404)
      try {
        const res = await fetch(`${API.profiles}/${addr}`);
        if (res.ok) {
          const prof = await res.json();
          setProfile(prof);
        } else if (res.status === 404) {
          console.info("No profile found for this wallet yet.");
          setProfile(null);
        } else {
          const t = await res.text();
          console.error("Profile fetch failed:", t);
          setProfile(null);
        }
      } catch (err) {
        console.error("Profile fetch network error:", err);
        setProfile(null);
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const submitPost = async (e) => {
    e.preventDefault();
    // Require wallet, profile, and >=1 CritCoin
    if (!wallet) { alert("Connect wallet first"); return; }
    if (!profile) { alert("Create a profile before posting"); return; }
    if (Number(balance) < 1) { alert("Need ≥1 CritCoin to post"); return; }
    if (!newPost.trim()) { alert("Post cannot be empty"); return; }
    
    // Validate post length (match backend 2000 char limit)
    if (newPost.trim().length > 2000) {
      alert("Post is too long. Maximum 2000 characters allowed.");
      return;
    }

    try {
      const res = await fetch(API.posts, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorWallet: wallet, content: newPost })
      });

      if (!res.ok) {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Post failed:", error);
        
        if (error.errors && Array.isArray(error.errors)) {
          // Handle validation errors
          const errorMessages = error.errors.map(err => err.msg).join(", ");
          alert("Post validation failed: " + errorMessages);
        } else {
          alert("Post failed: " + (error.error || error));
        }
        return;
      }

      setNewPost("");
      fetchPosts();
    } catch (err) {
      console.error("Network error submitting post:", err);
      if (err.name === 'NetworkError' || err.message.includes('fetch')) {
        alert("❌ Network error. Please check your internet connection and try again.");
      } else {
        alert("❌ Error submitting post. Please try again.");
      }
    }
  };

  const vote = async (id, type) => {
    if (!wallet) {
      alert("Connect wallet to vote");
      return;
    }
    
    try {
      const res = await fetch(`${API.posts}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id, type, voterWallet: wallet })
      });
      
      if (!res.ok) {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Vote failed:", error);
        
        if (error.errors && Array.isArray(error.errors)) {
          // Handle validation errors
          const errorMessages = error.errors.map(err => err.msg).join(", ");
          alert("Vote validation failed: " + errorMessages);
        } else {
          alert("Vote failed: " + (error.error || error));
        }
        return;
      }
      
      fetchPosts();
    } catch (err) {
      console.error("Vote error:", err);
      if (err.name === 'NetworkError' || err.message.includes('fetch')) {
        alert("❌ Network error. Please check your internet connection and try again.");
      } else {
        alert("❌ Voting failed. Please try again.");
      }
    }
  };

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 className="gothic-title gothic-text">CritCoin Forum</h1>

      {!wallet ? (
        <div className="artistic-card" style={{ textAlign: "center", padding: "2rem" }}>
          <h3 className="royal-text">Wallet Connection Required</h3>
          <p style={{ marginBottom: "1.5rem", fontFamily: 'Crimson Text, serif', fontStyle: 'italic' }}>Connect your wallet to access the forum</p>
          <button onClick={connectWallet} className="artistic-btn">Connect Wallet</button>
        </div>
      ) : (
        <>
          <div className="artistic-card" style={{ marginBottom: "1.5rem", background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.05), rgba(37, 99, 235, 0.03))', border: '2px solid var(--complement-green)' }}>
            <p style={{ fontFamily: 'Crimson Text, serif', fontSize: '1.1rem' }}>
              <span className="sage-text" style={{ fontWeight: '600' }}>User:</span> <code style={{ color: 'var(--accent-gold)', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.5rem', borderRadius: '3px' }}>{profile?.name || wallet}</code> 
              <span style={{ margin: '0 1rem', color: 'rgba(255,255,255,0.5)' }}>•</span>
              <span className="royal-text" style={{ fontWeight: '600' }}>Balance:</span> <span style={{ color: 'var(--accent-copper)', fontWeight: 'bold' }}>{balance}</span> <span className="silver-text">CritCoin</span>
            </p>
          </div>

          {profile && Number(balance) >= 1 ? (
            <div className="artistic-form">
              <h3 className="copper-text" style={{ marginBottom: '1rem', fontFamily: 'Cinzel, serif' }}>Share Your Thoughts</h3>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows={4}
                placeholder="Write your message... (max 2000 characters)"
                maxLength="2000"
                required
                className="artistic-input"
                style={{ fontFamily: 'Crimson Text, serif', minHeight: '120px', resize: 'vertical' }}
              />
              <div style={{ 
                fontSize: "0.8em", 
                color: newPost.length > 1800 ? "var(--accent-copper)" : "rgba(255,255,255,0.6)", 
                textAlign: "right",
                fontFamily: 'Crimson Text, serif',
                marginTop: '0.5rem'
              }}>
                {newPost.length}/2000 characters
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button type="submit" onClick={submitPost} className="artistic-btn">Post Message</button>
              </div>
            </div>
          ) : (
            <div className="artistic-card" style={{ 
              border: '2px solid var(--neon-orange)', 
              background: 'rgba(255, 102, 0, 0.1)',
              textAlign: 'center'
            }}>
              <p style={{ color: "var(--neon-orange)", fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>
                { !profile
                  ? <>⚠️ PROFILE REQUIRED — <Link to="/profiles" style={{ color: 'var(--neon-pink)' }}>Initialize Identity Matrix</Link> to broadcast</>
                  : "⚠️ INSUFFICIENT CREDITS — Need ≥1 CritCoin to transmit" }
              </p>
            </div>
          )}
        </>
      )}

      <div style={{ height: '2px', background: 'var(--gradient-primary)', margin: '2rem 0', borderRadius: '1px' }}></div>
      <div className="artistic-card" style={{ background: 'rgba(26, 26, 26, 0.6)', padding: '1rem' }}>
        <h2 className="sage-text" style={{ marginBottom: '1.5rem', textAlign: 'center', fontFamily: 'Cinzel, serif' }}>Forum Posts</h2>
      </div>
      
      {posts.map((p) => (
        <div key={p._id} className="artistic-card" style={{ 
          marginBottom: "1.5rem", 
          background: 'rgba(42, 42, 42, 0.8)',
          border: '1px solid var(--dark-border)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Glowing border animation */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'var(--gradient-accent)',
            animation: 'pulse 3s ease-in-out infinite'
          }}></div>
          
          <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
            {p.authorPhoto ? (
              <img
                src={`${API.profiles}/photo/${p.authorPhoto}`}
                alt="Profile"
                className="artistic-profile-img"
                style={{
                  width: "50px",
                  height: "50px",
                  marginRight: "1rem"
                }}
              />
            ) : (
              <div style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                background: 'var(--gradient-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: "1rem",
                fontSize: '1.5rem'
              }}>P</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontFamily: 'Cinzel, serif', 
                color: 'var(--accent-gold)',
                fontWeight: '600',
                marginBottom: '0.25rem'
              }}>
                {p.authorName}
              </div>
              <div style={{ 
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.5)",
                fontFamily: 'Crimson Text, serif',
                fontStyle: 'italic'
              }}>
                {new Date(p.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--dark-elevated)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            fontFamily: 'Space Mono, monospace',
            lineHeight: '1.6'
          }}>
            {p.content}
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            padding: '0.75rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '6px',
            border: '1px solid var(--dark-elevated)'
          }}>
            {/* Vote counts always visible */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "0.5rem",
                padding: '0.5rem 0.75rem',
                background: 'rgba(22, 163, 74, 0.1)',
                border: '1px solid var(--complement-green)',
                borderRadius: '20px'
              }}>
                ↑
                <span style={{
                  color: "var(--complement-green)",
                  fontWeight: "bold",
                  fontFamily: 'Cinzel, serif',
                  marginLeft: '0.5rem'
                }}>{p.upvotes || 0}</span>
              </div>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "0.5rem",
                padding: '0.5rem 0.75rem',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid var(--primary-red)',
                borderRadius: '20px'
              }}>
                ↓
                <span style={{
                  color: "var(--primary-red)",
                  fontWeight: "bold",
                  fontFamily: 'Cinzel, serif',
                  marginLeft: '0.5rem'
                }}>{p.downvotes || 0}</span>
              </div>
            </div>
            
            {/* Voting buttons only for connected users */}
            {wallet && (
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button 
                  onClick={() => vote(p._id, "up")}
                  disabled={p.votes && p.votes[wallet?.toLowerCase()] === "up"}
                  className="artistic-btn"
                  style={{ 
                    background: p.votes && p.votes[wallet?.toLowerCase()] === "up" 
                      ? 'var(--gradient-secondary)' 
                      : 'rgba(22, 163, 74, 0.1)',
                    border: "2px solid var(--complement-green)",
                    color: "white",
                    padding: "0.5rem 1rem",
                    cursor: p.votes && p.votes[wallet?.toLowerCase()] === "up" ? "default" : "pointer",
                    fontSize: "0.8rem",
                    fontFamily: 'Cinzel, serif',
                    opacity: p.votes && p.votes[wallet?.toLowerCase()] === "up" ? 0.7 : 1
                  }}
                  title={p.votes && p.votes[wallet?.toLowerCase()] === "up" ? "You upvoted this" : "Upvote"}
                >
                  ↑ Upvote
                </button>
                <button 
                  onClick={() => vote(p._id, "down")}
                  disabled={p.votes && p.votes[wallet?.toLowerCase()] === "down"}
                  className="artistic-btn"
                  style={{ 
                    background: p.votes && p.votes[wallet?.toLowerCase()] === "down" 
                      ? 'var(--gradient-primary)' 
                      : 'rgba(220, 38, 38, 0.1)',
                    border: "2px solid var(--primary-red)",
                    color: "white",
                    padding: "0.5rem 1rem",
                    cursor: p.votes && p.votes[wallet?.toLowerCase()] === "down" ? "default" : "pointer",
                    fontSize: "0.8rem",
                    fontFamily: 'Cinzel, serif',
                    opacity: p.votes && p.votes[wallet?.toLowerCase()] === "down" ? 0.7 : 1
                  }}
                  title={p.votes && p.votes[wallet?.toLowerCase()] === "down" ? "You downvoted this" : "Downvote"}
                >
                  ↓ Downvote
                </button>
              </div>
            )}
            
            {/* Message for non-connected users */}
            {!wallet && (
              <div style={{
                padding: '0.5rem 1rem',
                background: 'rgba(108, 117, 125, 0.1)',
                border: '1px solid rgba(108, 117, 125, 0.3)',
                borderRadius: '20px',
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.6)",
                fontFamily: 'Fira Code, monospace',
                fontStyle: "italic"
              }}>
                // neural_link_required_to_vote
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
