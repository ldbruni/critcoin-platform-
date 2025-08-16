// src/pages/Profiles.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

// Debug environment variables
console.log("🔍 Environment debug:");
console.log("REACT_APP_API_URL:", process.env.REACT_APP_API_URL);

const API = {
  profiles: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/profiles` : "http://localhost:3001/api/profiles"
};

console.log("🔍 Final API.profiles URL:", API.profiles);

export default function Profiles() {
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", birthday: "", starSign: "" });
  const [editing, setEditing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const connectWallet = async () => {
    try {
      console.log("🔗 Connecting wallet...");
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      console.log("👤 Connected address:", addr);
      
      // Check network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const sepoliaChainId = '0xaa36a7';
      console.log("🌐 Current chain:", chainId, "Expected:", sepoliaChainId);
      
      if (chainId !== sepoliaChainId) {
        console.log("⚠️ Wrong network, attempting to switch...");
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: sepoliaChainId }],
          });
        } catch (switchError) {
          console.error("❌ Failed to switch network:", switchError);
          alert("Please switch to Sepolia network in MetaMask");
          return;
        }
      }
      
      setWallet(addr);

      console.log("💰 Getting CritCoin balance...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(deployed.address, deployed.abi, provider);
      
      try {
        const bal = await contract.balanceOf(addr);
        const balanceNumber = Number(bal.toString());
        console.log("💰 CritCoin balance:", balanceNumber);
        setBalance(balanceNumber);
      } catch (contractError) {
        console.error("❌ Contract error:", contractError);
        setBalance(0);
      }

      console.log("👤 Fetching profile...");
      const res = await fetch(`${API.profiles}/${addr}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setForm({
          name: data.name || "",
          birthday: data.birthday || "",
          starSign: data.starSign || ""
        });
      } else if (res.status === 404) {
        setProfile(null);
      } else {
        console.error("Profile fetch error:", await res.text());
      }
    } catch (err) {
      console.error("❌ Wallet connect error:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      setSelectedPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wallet) return;

    // Check balance requirement for new profile creation
    if (!profile && Number(balance) < 1) {
      alert("You need at least 1 CritCoin to create a profile");
      return;
    }

    const endpoint = profile ? `${API.profiles}/update` : API.profiles;

    try {
      const formData = new FormData();
      formData.append('wallet', wallet);
      formData.append('name', form.name);
      formData.append('birthday', form.birthday);
      formData.append('starSign', form.starSign);
      formData.append('balance', balance); // Pass current balance for backend validation
      
      if (selectedPhoto) {
        formData.append('photo', selectedPhoto);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData // Don't set Content-Type header, let browser set it
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditing(false);
        setSelectedPhoto(null);
        setPhotoPreview(null);
      } else {
        const errText = await res.text();
        console.error("Save failed:", errText);
        alert("Profile save error: " + errText);
      }
    } catch (err) {
      console.error("Profile submit error:", err);
    }
  };

  useEffect(() => {
    if (window.ethereum) connectWallet();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🪪 CritCoin Profile</h1>
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
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : profile && !editing ? (
        <>
          <p><strong>Wallet:</strong> {wallet}</p>
          <p><strong>Balance:</strong> {balance} CritCoin</p>
          <h3>Your Profile</h3>
          {profile.photo && (
            <div style={{ marginBottom: "1rem" }}>
              <img 
                src={`${API.profiles}/photo/${profile.photo}`}
                alt="Profile"
                style={{ 
                  width: "150px", 
                  height: "150px", 
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "2px solid #ddd"
                }}
              />
            </div>
          )}
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>Birthday:</strong> {profile.birthday}</p>
          <p><strong>Star Sign:</strong> {profile.starSign}</p>
          <button onClick={() => setEditing(true)}>Edit</button>
        </>
      ) : (
        <>
          <p>{profile ? "Edit your profile:" : "No profile found. Create one:"}</p>
          {!profile && Number(balance) < 1 && (
            <div style={{ 
              backgroundColor: "#ffebee", 
              border: "1px solid #f44336", 
              borderRadius: "4px", 
              padding: "1rem", 
              marginBottom: "1rem",
              color: "#c62828"
            }}>
              <strong>⚠️ Insufficient Balance</strong>
              <p>You need at least 1 CritCoin to create a profile. Your current balance: {balance} CritCoin</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label>Profile Photo (1080x1080):</label><br />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ marginTop: "0.5rem" }}
                disabled={!profile && Number(balance) < 1}
              />
              {(photoPreview || (profile?.photo && !selectedPhoto)) && (
                <div style={{ marginTop: "0.5rem" }}>
                  <img 
                    src={photoPreview || `${API.profiles}/photo/${profile.photo}`}
                    alt="Preview"
                    style={{ 
                      width: "150px", 
                      height: "150px", 
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "2px solid #ddd"
                    }}
                  />
                </div>
              )}
            </div>
            <input
              name="name"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
              required
              disabled={!profile && Number(balance) < 1}
            /><br />
            <input
              name="birthday"
              type="date"
              value={form.birthday}
              onChange={handleChange}
              required
              disabled={!profile && Number(balance) < 1}
            /><br />
            <input
              name="starSign"
              placeholder="Star Sign"
              value={form.starSign}
              onChange={handleChange}
              required
              disabled={!profile && Number(balance) < 1}
            /><br />
            <button 
              type="submit" 
              disabled={!profile && Number(balance) < 1}
              style={{ 
                opacity: (!profile && Number(balance) < 1) ? 0.5 : 1,
                cursor: (!profile && Number(balance) < 1) ? "not-allowed" : "pointer"
              }}
            >
              Save Profile
            </button>
            {profile && <button type="button" onClick={() => {
              setEditing(false);
              setSelectedPhoto(null);
              setPhotoPreview(null);
            }}>Cancel</button>}
          </form>
        </>
      )}
    </div>
  );
}
