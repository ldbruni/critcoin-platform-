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
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
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
      console.log("📸 Photo selected:", {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG, PNG, etc.)');
        return;
      }
      
      // Check file size (limit to 10MB for mobile compatibility)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('Photo file is too large. Please select a file smaller than 10MB.');
        return;
      }
      
      setSelectedPhoto(file);
      
      // Create preview with error handling
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log("📸 Photo preview loaded successfully");
        setPhotoPreview(e.target.result);
      };
      reader.onerror = (e) => {
        console.error("❌ Photo preview failed:", e);
        alert("Failed to load photo preview. You can still submit the form.");
      };
      reader.readAsDataURL(file);
    } else {
      console.log("📸 No photo selected");
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
      console.log("🚀 Submitting profile form:", {
        endpoint,
        hasPhoto: !!selectedPhoto,
        photoInfo: selectedPhoto ? {
          name: selectedPhoto.name,
          size: selectedPhoto.size,
          type: selectedPhoto.type
        } : null
      });
      
      const formData = new FormData();
      formData.append('wallet', wallet);
      formData.append('name', form.name);
      formData.append('birthday', form.birthday);
      formData.append('starSign', form.starSign);
      formData.append('balance', balance); // Pass current balance for backend validation
      
      if (selectedPhoto) {
        console.log("📸 Adding photo to form data");
        formData.append('photo', selectedPhoto);
        
        // Log FormData contents (for debugging)
        for (let pair of formData.entries()) {
          if (pair[0] === 'photo') {
            console.log("📸 FormData photo:", pair[1].name, pair[1].size, "bytes");
          } else {
            console.log("📝 FormData field:", pair[0], pair[1]);
          }
        }
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
        // Refresh public profiles to show updated profile
        fetchPublicProfiles();
      } else {
        const errText = await res.text();
        console.error("Save failed:", errText);
        
        // Handle specific whitelist error with user-friendly message
        if (res.status === 403 && errText.includes("whitelist")) {
          alert("⚠️ Profile Creation Restricted\n\nProfile creation is currently restricted to whitelisted wallets only. Please contact your instructor to be added to the whitelist.");
        } else {
          alert("Profile save error: " + errText);
        }
      }
    } catch (err) {
      console.error("Profile submit error:", err);
    }
  };

  const fetchPublicProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const res = await fetch(`${API.profiles}`);
      
      if (res.ok) {
        const profiles = await res.json();
        setPublicProfiles(profiles);
      } else {
        console.error("Failed to fetch public profiles");
      }
    } catch (err) {
      console.error("Error fetching public profiles:", err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchPublicProfiles();
  }, []);

  useEffect(() => {
    const checkWallet = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            connectWallet();
          }
        } catch (err) {
          // Silently ignore wallet errors
        }
      }
    };
    checkWallet();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🪪 CritCoin Profile</h1>

      {!wallet ? (
        <div>
          <div style={{ 
            backgroundColor: "#f8f9fa", 
            padding: "1.5rem", 
            borderRadius: "8px", 
            marginBottom: "2rem",
            textAlign: "center"
          }}>
            <h3>🔗 Connect Your Wallet</h3>
            <p>Connect your wallet to create or edit your profile</p>
            <button 
              onClick={connectWallet}
              style={{
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "1rem"
              }}
            >
              Connect Wallet
            </button>
          </div>

          <h2>👥 Community Profiles</h2>
          <p style={{ marginBottom: "2rem", color: "#666" }}>
            Discover the CritCoin community members and their profiles
          </p>


          {loadingProfiles ? (
            <p style={{ textAlign: "center", color: "#666" }}>
              Loading community profiles...
            </p>
          ) : publicProfiles.length === 0 ? (
            <p style={{ textAlign: "center", color: "#999", fontStyle: "italic" }}>
              No profiles found. Be the first to create one!
            </p>
          ) : (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
              gap: "1.5rem" 
            }}>
              {publicProfiles.map((prof) => (
                <div 
                  key={prof._id}
                  style={{ 
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "1.5rem",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    {prof.photo ? (
                      <img 
                        src={`${API.profiles}/photo/${prof.photo}`}
                        alt={`${prof.name || 'Profile'}'s profile`}
                        style={{ 
                          width: "80px", 
                          height: "80px", 
                          objectFit: "cover",
                          borderRadius: "50%",
                          border: "3px solid #007bff",
                          backgroundColor: "#f8f9fa"
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      style={{ 
                        width: "80px", 
                        height: "80px", 
                        borderRadius: "50%",
                        border: "3px solid #007bff",
                        backgroundColor: "#e9ecef",
                        display: prof.photo ? "none" : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        color: "#6c757d",
                        margin: "0 auto"
                      }}
                    >
                      👤
                    </div>
                  </div>
                  <h4 style={{ 
                    textAlign: "center", 
                    marginBottom: "0.5rem",
                    color: "#333"
                  }}>
                    {prof.name || prof.wallet?.slice(0, 8) + '...' || 'Unknown User'}
                  </h4>
                  {prof.starSign && (
                    <p style={{ 
                      textAlign: "center", 
                      color: "#666",
                      fontSize: "0.9rem",
                      marginBottom: "0.5rem"
                    }}>
                      ⭐ {prof.starSign}
                    </p>
                  )}
                  {prof.bio && (
                    <p style={{ 
                      fontSize: "0.9rem",
                      color: "#666",
                      textAlign: "center",
                      lineHeight: "1.4"
                    }}>
                      {prof.bio}
                    </p>
                  )}
                  <div style={{ 
                    marginTop: "1rem",
                    padding: "0.5rem",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    color: "#666",
                    textAlign: "center"
                  }}>
                    Joined: {new Date(prof.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
              <label>Profile Photo:</label><br />
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
                capture="environment"
                onChange={handlePhotoChange}
                style={{ 
                  marginTop: "0.5rem",
                  width: "100%",
                  padding: "0.5rem",
                  border: "2px dashed #ccc",
                  borderRadius: "4px",
                  backgroundColor: "#f9f9f9"
                }}
                disabled={!profile && Number(balance) < 1}
              />
              <small style={{ display: "block", marginTop: "0.25rem", color: "#666" }}>
                📱 Tap to select or take a photo (max 10MB)
              </small>
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

      {/* Community Profiles Section for logged-in users */}
      {wallet && (
        <div style={{ marginTop: "3rem", borderTop: "2px solid #eee", paddingTop: "2rem" }}>
          <h2>👥 Community Profiles</h2>
          <p style={{ marginBottom: "2rem", color: "#666" }}>
            Discover other CritCoin community members
          </p>

          {publicProfiles.length === 0 ? (
            <p style={{ textAlign: "center", color: "#999", fontStyle: "italic" }}>
              No other profiles found yet.
            </p>
          ) : (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
              gap: "1.5rem" 
            }}>
              {publicProfiles
                .filter(prof => prof.wallet.toLowerCase() !== wallet.toLowerCase()) // Exclude current user
                .map((prof) => (
                <div 
                  key={prof._id}
                  style={{ 
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "1.5rem",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    {prof.photo ? (
                      <img 
                        src={`${API.profiles}/photo/${prof.photo}`}
                        alt={`${prof.name}'s profile`}
                        style={{ 
                          width: "70px", 
                          height: "70px", 
                          objectFit: "cover",
                          borderRadius: "50%",
                          border: "3px solid #007bff",
                          backgroundColor: "#f8f9fa"
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      style={{ 
                        width: "70px", 
                        height: "70px", 
                        borderRadius: "50%",
                        border: "3px solid #007bff",
                        backgroundColor: "#e9ecef",
                        display: prof.photo ? "none" : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.8rem",
                        color: "#6c757d",
                        margin: "0 auto"
                      }}
                    >
                      👤
                    </div>
                  </div>
                  <h4 style={{ 
                    textAlign: "center", 
                    marginBottom: "0.5rem",
                    color: "#333"
                  }}>
                    {prof.name}
                  </h4>
                  {prof.starSign && (
                    <p style={{ 
                      textAlign: "center", 
                      color: "#666",
                      fontSize: "0.9rem",
                      marginBottom: "0.5rem"
                    }}>
                      ⭐ {prof.starSign}
                    </p>
                  )}
                  {prof.bio && (
                    <p style={{ 
                      fontSize: "0.9rem",
                      color: "#666",
                      textAlign: "center",
                      lineHeight: "1.4"
                    }}>
                      {prof.bio}
                    </p>
                  )}
                  <div style={{ 
                    marginTop: "1rem",
                    padding: "0.5rem",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    color: "#666",
                    textAlign: "center"
                  }}>
                    Joined: {new Date(prof.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
