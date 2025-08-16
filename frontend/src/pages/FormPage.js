// src/pages/ForumPage.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

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
    if (!newPost.trim()) { return; }

    try {
      const res = await fetch(API.posts, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorWallet: wallet, content: newPost })
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("Post failed:", t);
        alert("Post failed: " + t);
        return;
      }

      setNewPost("");
      fetchPosts();
    } catch (err) {
      console.error("Network error submitting post:", err);
      alert("Error submitting post. Check console.");
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
        const errorText = await res.text();
        alert(errorText);
        return;
      }
      
      fetchPosts();
    } catch (err) {
      console.error("Vote error:", err);
      alert("Voting failed. Please try again.");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      <h1>💬 CritCoin Forum</h1>

      {!wallet ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p><strong>{profile?.name || wallet}</strong> — {balance} CritCoin</p>

          {profile && Number(balance) >= 1 ? (
            <form onSubmit={submitPost}>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows={4}
                placeholder="Write something…"
                required
              />
              <br />
              <button type="submit">Post</button>
            </form>
          ) : (
            <p style={{ color: "red" }}>
              { !profile
                ? <>No profile found. <Link to="/profiles">Create your profile</Link> to post.</>
                : "You need ≥1 CritCoin to post." }
            </p>
          )}
        </>
      )}

      <hr />
      {posts.map((p) => (
        <div key={p._id} style={{ marginBottom: "1.5rem", borderBottom: "1px solid #ccc" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
            {p.authorPhoto && (
              <img
                src={`${API.profiles}/photo/${p.authorPhoto}`}
                alt="Profile"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  marginRight: "0.5rem",
                  border: "1px solid #ddd"
                }}
              />
            )}
            <div>
              <strong>{p.authorName}</strong>{" "}
              <small style={{ color: "#777" }}>
                ({new Date(p.createdAt).toLocaleString()})
              </small>
            </div>
          </div>
          <p>{p.content}</p>
          {wallet && (
            <div>
              <button 
                onClick={() => vote(p._id, "up")}
                disabled={p.votes && p.votes[wallet?.toLowerCase()] === "up"}
                style={{ 
                  backgroundColor: p.votes && p.votes[wallet?.toLowerCase()] === "up" ? "#90EE90" : "",
                  opacity: p.votes && p.votes[wallet?.toLowerCase()] === "up" ? 0.7 : 1
                }}
              >
                ⬆️ {p.upvotes}
              </button>
              <button 
                onClick={() => vote(p._id, "down")}
                disabled={p.votes && p.votes[wallet?.toLowerCase()] === "down"}
                style={{ 
                  backgroundColor: p.votes && p.votes[wallet?.toLowerCase()] === "down" ? "#FFB6C1" : "",
                  opacity: p.votes && p.votes[wallet?.toLowerCase()] === "down" ? 0.7 : 1,
                  marginLeft: "8px"
                }}
              >
                ⬇️ {p.downvotes}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
