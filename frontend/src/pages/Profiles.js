// src/pages/Profiles.js
// Build: 2025-10-17-03:15 - Cloudinary direct URLs
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBalance } from "../utils/balance";

// Debug environment variables
console.log("🔍 Environment debug:");
console.log("REACT_APP_API_URL:", process.env.REACT_APP_API_URL);
console.log("📱 User Agent:", navigator.userAgent);
console.log("📱 Is Mobile:", /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

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

  // Copy wallet address to clipboard
  const copyWalletAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      alert('Wallet address copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy wallet address:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Wallet address copied to clipboard!');
    }
  };

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

      // Balance comes from the database ledger, not the chain.
      console.log("💰 Getting CritCoin balance...");
      const balanceNumber = await fetchBalance(addr);
      console.log("💰 CritCoin balance:", balanceNumber);
      setBalance(balanceNumber);

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
      
      // Check file size (updated to 5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('Photo file is too large. Please select a file smaller than 5MB.');
        return;
      }
      
      // Enhanced file type validation
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, GIF, or WebP).');
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

    // Frontend validation to match backend requirements
    if (!form.name.trim() || form.name.trim().length < 1 || form.name.trim().length > 50) {
      alert("Name must be 1-50 characters long");
      return;
    }

    if (!form.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter a valid date in YYYY-MM-DD format");
      return;
    }

    const validStarSigns = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    
    if (!validStarSigns.includes(form.starSign)) {
      alert("Please select a valid star sign");
      return;
    }

    // No balance gate on profile creation: a new student has no ledger history
    // yet, so requiring a balance here could never be satisfied. Creating the
    // profile issues a joining credit, which then covers the >=1 CritCoin
    // requirement for posting, submitting projects and tipping.

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
      // No balance field: the server computes it from the ledger itself.

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
        alert(`✅ Profile ${profile ? 'updated' : 'created'} successfully!`);
      } else {
        const error = await res.json().catch(async () => ({ error: await res.text() }));
        console.error("Save failed:", error);
        
        if (error.errors && Array.isArray(error.errors)) {
          // Handle validation errors
          const errorMessages = error.errors.map(err => err.msg).join("\n");
          alert("Profile validation failed:\n" + errorMessages);
        } else if (res.status === 403 && (error.error || error).includes("whitelist")) {
          alert("⚠️ Profile Creation Restricted\n\nProfile creation is currently restricted to whitelisted wallets only. Please contact your instructor to be added to the whitelist.");
        } else {
          alert("Profile save error: " + (error.error || error));
        }
      }
    } catch (err) {
      console.error("Profile submit error:", err);
      if (err.name === 'NetworkError' || err.message.includes('fetch')) {
        alert('❌ Network error. Please check your internet connection and try again.');
      } else if (err.message.includes('signature')) {
        alert('❌ Signature error. Please make sure your wallet is connected and try again.');
      } else {
        alert('❌ An unexpected error occurred. Please try again.');
      }
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
    <div className="artistic-container" style={{ padding: "2rem" }}>
      <div className="v2-masthead">
        <div className="v2-kicker">CritCoin · Profiles</div>
        <h1 className="gothic-title gothic-text">CritCoin Profiles</h1>
      </div>

      {!wallet ? (
        <div>
          <div className="artistic-card" style={{ 
            textAlign: "center",
            padding: "2rem",
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(22, 163, 74, 0.03))',
            border: '2px solid var(--primary-blue)'
          }}>
            <h3 className="royal-text" style={{ fontFamily: 'var(--font-heading)' }}>Wallet Connection Required</h3>
            <p style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.8)', marginBottom: '1.5rem', fontStyle: 'italic' }}>Connect your wallet to create or edit your profile</p>
            <button onClick={connectWallet} className="artistic-btn">
              Connect Wallet
            </button>
          </div>

          <div className="artistic-card" style={{ textAlign: 'center', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.08), rgba(245, 158, 11, 0.05))', border: '2px solid var(--status-positive)' }}>
            <h2 className="sage-text" style={{ fontFamily: 'var(--font-heading)' }}>Community Profiles</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
              Discover the CritCoin community members
            </p>
          </div>


          {loadingProfiles ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
              Loading community profiles...
            </p>
          ) : publicProfiles.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-faint)", fontStyle: "italic" }}>
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
                    backgroundColor: "var(--surface-card)",
                    border: "1px solid var(--surface-card-border)",
                    borderRadius: "8px",
                    padding: "1.5rem",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    {prof.photo ? (
                      <img
                        src={prof.photo}
                        alt={`${prof.name || 'Profile'}'s profile`}
                        style={{
                          width: "80px",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "50%",
                          border: "3px solid var(--primary-blue)",
                          backgroundColor: "var(--surface-muted)"
                        }}
                        onError={(e) => {
                          console.error("❌ Failed to load profile photo:", prof.photo);
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                        onLoad={() => console.log("✅ Profile photo loaded:", prof.name)}
                      />
                    ) : null}
                    <div 
                      style={{ 
                        width: "80px", 
                        height: "80px", 
                        borderRadius: "50%",
                        border: "3px solid var(--primary-blue)",
                        backgroundColor: "var(--surface-card-border)",
                        display: prof.photo ? "none" : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        color: "var(--text-muted)",
                        margin: "0 auto"
                      }}
                    >
                      P
                    </div>
                  </div>
                  <h4 style={{ 
                    textAlign: "center", 
                    marginBottom: "0.5rem",
                    color: "var(--text-body)"
                  }}>
                    {prof.name || prof.wallet?.slice(0, 8) + '...' || 'Unknown User'}
                  </h4>
                  {prof.starSign && (
                    <p style={{ 
                      textAlign: "center", 
                      color: "var(--text-muted)",
                      fontSize: "0.9rem",
                      marginBottom: "0.5rem"
                    }}>
                      Star sign: {prof.starSign}
                    </p>
                  )}
                  
                  {/* Wallet Address with Copy Button */}
                  <div style={{ 
                    textAlign: "center", 
                    marginBottom: "0.5rem",
                    padding: "0.5rem",
                    backgroundColor: "var(--surface-muted)",
                    borderRadius: "4px",
                    border: "1px solid var(--surface-card-border)"
                  }}>
                    <div style={{ 
                      fontSize: "0.75rem", 
                      color: "var(--text-muted)", 
                      marginBottom: "0.25rem",
                      fontWeight: "600"
                    }}>
                      Wallet Address
                    </div>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      gap: "0.5rem" 
                    }}>
                      <code style={{ 
                        fontSize: "0.75rem", 
                        backgroundColor: "var(--panel-2)", 
                        padding: "0.25rem 0.5rem", 
                        borderRadius: "3px",
                        border: "1px solid var(--surface-card-border)",
                        color: "var(--text-body)",
                        wordBreak: "break-all"
                      }}>
                        {prof.wallet}
                      </code>
                      <button
                        onClick={() => copyWalletAddress(prof.wallet)}
                        style={{
                          backgroundColor: "var(--primary-blue)",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.7rem",
                          cursor: "pointer",
                          minWidth: "50px"
                        }}
                        title="Copy wallet address"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  {prof.bio && (
                    <p style={{ 
                      fontSize: "0.9rem",
                      color: "var(--text-muted)",
                      textAlign: "center",
                      lineHeight: "1.4"
                    }}>
                      {prof.bio}
                    </p>
                  )}
                  <div style={{ 
                    marginTop: "1rem",
                    padding: "0.5rem",
                    backgroundColor: "var(--surface-muted)",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
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
          <div className="artistic-card" style={{ background: 'rgba(0, 255, 255, 0.05)', border: '2px solid var(--primary-blue)', marginBottom: '1.5rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>
              <span className="neon-green-text">WALLET:</span> <code style={{ color: 'var(--accent-orange)', fontSize: '0.9rem' }}>{wallet}</code>
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>
              <span className="neon-cyan-text">CREDITS:</span> <span className="ledger-num" style={{ color: 'var(--accent-orange)', fontWeight: 'bold' }}>{balance}</span> <span className="neon-green-text">CritCoin</span>
            </p>
          </div>
          <h3 className="neon-purple-text" style={{ fontFamily: 'var(--font-mono)', textAlign: 'center', marginBottom: '1.5rem' }}>YOUR DIGITAL IDENTITY</h3>
          {profile.photo && (
            <div style={{ marginBottom: "1rem" }}>
              <img
                src={profile.photo}
                alt="Profile"
                style={{
                  width: "150px",
                  height: "150px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "2px solid var(--surface-card-border)"
                }}
                onError={(e) => {
                  console.error("❌ Failed to load your profile photo:", profile.photo);
                  e.target.style.display = 'none';
                }}
                onLoad={() => console.log("✅ Your profile photo loaded successfully")}
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
          {!profile && (
            <div style={{
              backgroundColor: "var(--tint-positive)",
              border: "1px solid var(--status-positive)",
              borderRadius: "4px",
              padding: "1rem",
              marginBottom: "1rem",
              color: "var(--status-positive)"
            }}>
              <strong>Welcome</strong>
              <p>Creating your profile grants you 1 CritCoin to get started.</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label>Profile Photo:</label><br />
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handlePhotoChange}
                style={{ 
                  marginTop: "0.5rem",
                  width: "100%",
                  padding: "0.5rem",
                  border: "2px dashed var(--surface-card-border)",
                  borderRadius: "4px",
                  backgroundColor: "var(--surface-muted)"
                }}              />
              <small style={{ display: "block", marginTop: "0.25rem", color: "var(--text-muted)" }}>
                📱 Tap to select or take a photo (max 5MB) - JPEG, PNG, GIF, WebP only
              </small>
              {(photoPreview || (profile?.photo && !selectedPhoto)) && (
                <div style={{ marginTop: "0.5rem" }}>
                  <img
                    src={photoPreview || profile.photo}
                    alt="Profile Preview"
                    style={{
                      width: "150px",
                      height: "150px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "2px solid var(--surface-card-border)",
                      backgroundColor: "var(--surface-muted)"
                    }}
                    onLoad={() => console.log("✅ Profile photo preview loaded successfully")}
                    onError={(e) => {
                      console.error("❌ Profile photo preview failed to load:", e.target.src);
                      e.target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.style.cssText = `
                        width: 150px;
                        height: 150px;
                        border-radius: 8px;
                        border: 2px solid var(--surface-card-border);
                        background-color: var(--surface-muted);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 3rem;
                        color: var(--text-faint);
                      `;
                      fallback.textContent = 'P';
                      e.target.parentNode.appendChild(fallback);
                    }}
                  />
                </div>
              )}
            </div>
            <input
              name="name"
              placeholder="Name (1-50 characters)"
              value={form.name}
              onChange={handleChange}
              maxLength="50"
              required            /><br />
            <input
              name="birthday"
              type="date"
              value={form.birthday}
              onChange={handleChange}
              required            /><br />
            <select
              name="starSign"
              value={form.starSign}
              onChange={handleChange}
              required              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            >
              <option value="">Select Star Sign</option>
              <option value="Aries">Aries</option>
              <option value="Taurus">Taurus</option>
              <option value="Gemini">Gemini</option>
              <option value="Cancer">Cancer</option>
              <option value="Leo">Leo</option>
              <option value="Virgo">Virgo</option>
              <option value="Libra">Libra</option>
              <option value="Scorpio">Scorpio</option>
              <option value="Sagittarius">Sagittarius</option>
              <option value="Capricorn">Capricorn</option>
              <option value="Aquarius">Aquarius</option>
              <option value="Pisces">Pisces</option>
            </select><br />
            <button type="submit" style={{ cursor: "pointer" }}>
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
        <div style={{ marginTop: "3rem", borderTop: "2px solid var(--surface-card-border)", paddingTop: "2rem" }}>
          <h2>👥 Community Profiles</h2>
          <p style={{ marginBottom: "2rem", color: "var(--text-muted)" }}>
            Discover other CritCoin community members
          </p>

          {publicProfiles.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-faint)", fontStyle: "italic" }}>
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
                    backgroundColor: "var(--surface-card)",
                    border: "1px solid var(--surface-card-border)",
                    borderRadius: "8px",
                    padding: "1.5rem",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    {prof.photo ? (
                      <img
                        src={prof.photo}
                        alt={`${prof.name}'s profile`}
                        style={{
                          width: "70px",
                          height: "70px",
                          objectFit: "cover",
                          borderRadius: "50%",
                          border: "3px solid var(--primary-blue)",
                          backgroundColor: "var(--surface-muted)"
                        }}
                        onError={(e) => {
                          console.error("❌ Failed to load profile photo for:", prof.name);
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                        onLoad={() => console.log("✅ Community profile photo loaded:", prof.name)}
                      />
                    ) : null}
                    <div 
                      style={{ 
                        width: "70px", 
                        height: "70px", 
                        borderRadius: "50%",
                        border: "3px solid var(--primary-blue)",
                        backgroundColor: "var(--surface-card-border)",
                        display: prof.photo ? "none" : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.8rem",
                        color: "var(--text-muted)",
                        margin: "0 auto"
                      }}
                    >
                      P
                    </div>
                  </div>
                  <h4 style={{ 
                    textAlign: "center", 
                    marginBottom: "0.5rem",
                    color: "var(--text-body)"
                  }}>
                    {prof.name}
                  </h4>
                  {prof.starSign && (
                    <p style={{ 
                      textAlign: "center", 
                      color: "var(--text-muted)",
                      fontSize: "0.9rem",
                      marginBottom: "0.5rem"
                    }}>
                      Star sign: {prof.starSign}
                    </p>
                  )}
                  
                  {/* Wallet Address with Copy Button */}
                  <div style={{ 
                    textAlign: "center", 
                    marginBottom: "0.5rem",
                    padding: "0.5rem",
                    backgroundColor: "var(--surface-muted)",
                    borderRadius: "4px",
                    border: "1px solid var(--surface-card-border)"
                  }}>
                    <div style={{ 
                      fontSize: "0.75rem", 
                      color: "var(--text-muted)", 
                      marginBottom: "0.25rem",
                      fontWeight: "600"
                    }}>
                      Wallet Address
                    </div>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      gap: "0.5rem" 
                    }}>
                      <code style={{ 
                        fontSize: "0.75rem", 
                        backgroundColor: "var(--panel-2)", 
                        padding: "0.25rem 0.5rem", 
                        borderRadius: "3px",
                        border: "1px solid var(--surface-card-border)",
                        color: "var(--text-body)",
                        wordBreak: "break-all"
                      }}>
                        {prof.wallet}
                      </code>
                      <button
                        onClick={() => copyWalletAddress(prof.wallet)}
                        style={{
                          backgroundColor: "var(--primary-blue)",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.7rem",
                          cursor: "pointer",
                          minWidth: "50px"
                        }}
                        title="Copy wallet address"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  {prof.bio && (
                    <p style={{ 
                      fontSize: "0.9rem",
                      color: "var(--text-muted)",
                      textAlign: "center",
                      lineHeight: "1.4"
                    }}>
                      {prof.bio}
                    </p>
                  )}
                  <div style={{ 
                    marginTop: "1rem",
                    padding: "0.5rem",
                    backgroundColor: "var(--surface-muted)",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
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
