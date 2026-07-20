// src/pages/Projects.js
// Build: 2025-10-27-05:30 - Changed description to Materials
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";
import { fetchBalance } from "../utils/balance";

const API = {
  profiles: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/profiles` : "http://localhost:3001/api/profiles",
  projects: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/projects` : "http://localhost:3001/api/projects"
};

export default function Projects() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [activeProject, setActiveProject] = useState(1);
  const [projects, setProjects] = useState([]);
  const [userSubmission, setUserSubmission] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sendAmounts, setSendAmounts] = useState({});

  useEffect(() => {
    if (window.ethereum) connectWallet();
  }, []);

  useEffect(() => {
    if (wallet) {
      fetchProjects();
      fetchUserSubmission();
    }
  }, [activeProject, wallet]);

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
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        setProfile(null);
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API.projects}/${activeProject}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        console.error("Failed to fetch projects");
      }
    } catch (err) {
      console.error("Network error fetching projects:", err);
    }
  };

  const fetchUserSubmission = async () => {
    if (!wallet) return;
    
    try {
      const res = await fetch(`${API.projects}/${activeProject}/${wallet}`);
      if (res.ok) {
        const submission = await res.json();
        setUserSubmission(submission);
        setForm({
          title: submission.title || "",
          description: submission.description || ""
        });
      } else if (res.status === 404) {
        setUserSubmission(null);
        setForm({ title: "", description: "" });
      }
    } catch (err) {
      console.error("Error fetching user submission:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wallet || !profile || Number(balance) < 1) {
      alert("You need a profile and ≥1 CritCoin to submit projects");
      return;
    }

    if (!form.title || (!selectedImage && !userSubmission)) {
      alert("Title and image are required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('wallet', wallet);
      formData.append('projectNumber', activeProject);
      formData.append('title', form.title);
      formData.append('description', form.description);
      // No balance field: the server computes it from the ledger itself.

      if (selectedImage) {
        formData.append('image', selectedImage);
      } else if (userSubmission) {
        // For updates without new image, we'll need to handle this differently
        // For now, require new image
        alert("Please select an image");
        return;
      }

      const res = await fetch(API.projects, {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        setEditing(false);
        setSelectedImage(null);
        setImagePreview(null);
        fetchProjects();
        fetchUserSubmission();
      } else {
        const errorText = await res.text();
        alert("Submission failed: " + errorText);
      }
    } catch (err) {
      console.error("Submission error:", err);
      alert("Error submitting project. Check console.");
    }
  };

  const handleSendCoin = async (projectId, recipientWallet) => {
    const amount = sendAmounts[projectId] || "";

    if (!wallet || !amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (Number(amount) > Number(balance)) {
      alert("Insufficient balance");
      return;
    }

    if (recipientWallet.toLowerCase() === wallet.toLowerCase()) {
      alert("You cannot send CritCoin to yourself");
      return;
    }

    try {
      // All projects use real blockchain transfers
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(deployed.address, deployed.abi, signer);

      // Execute blockchain transfer
      const tx = await contract.transfer(recipientWallet, Number(amount));
      alert("Transaction submitted! Waiting for confirmation...");

      // Wait for transaction to be mined
      await tx.wait();

      // Record transaction in backend
      const res = await fetch(`${API.projects}/send-coin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWallet: wallet,
          toWallet: recipientWallet,
          amount: Number(amount),
          projectId,
          txHash: tx.hash
        })
      });

      if (res.ok) {
        alert(`Successfully sent ${amount} CritCoin!\nTransaction: ${tx.hash}`);

        // Re-read the ledger balance now that the tip is recorded.
        setBalance(await fetchBalance(wallet));

        // Clear input and refresh projects
        setSendAmounts(prev => ({ ...prev, [projectId]: "" }));
        fetchProjects();
      } else {
        const errorText = await res.text();
        alert("Blockchain transfer succeeded but backend update failed: " + errorText);

        // Still update balance and clear input
        setBalance(await fetchBalance(wallet));
        setSendAmounts(prev => ({ ...prev, [projectId]: "" }));
        fetchProjects();
      }
    } catch (err) {
      console.error("Send coin error:", err);
      if (err.code === 4001) {
        alert("Transaction cancelled by user");
      } else if (err.message?.includes("Not enough tokens")) {
        // The displayed balance is the ledger's, but the tip is a real on-chain
        // transfer. If the wallet holds fewer tokens on Sepolia than the ledger
        // credits, the contract reverts here. That gap is real and is reported
        // in the admin reconciliation view - it is not corrected automatically.
        alert(
          "Your on-chain CritCoin balance is lower than your CritCoin balance shown here, " +
          "so the transfer was rejected by the contract.\n\n" +
          "Let your instructor know - they can check the reconciliation report."
        );
      } else if (err.code === -32603 || err.message?.includes("insufficient funds")) {
        alert("Insufficient funds for transaction (including gas fees)");
      } else {
        alert(`Error sending CritCoin: ${err.message || "Unknown error"}`);
      }
    }
  };

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div className="v2-masthead">
        <div className="v2-kicker">CritCoin · Projects</div>
        <h1 className="gothic-title gothic-text">Projects</h1>
      </div>

      {!wallet ? (
        <button className="artistic-btn" onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p><strong>{profile?.name || wallet}</strong> — <span className="ledger-num">{balance}</span> CritCoin</p>

          {/* Project Navigation */}
          <div style={{ marginBottom: "2rem" }}>
            <h3>Select Project:</h3>
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                onClick={() => setActiveProject(num)}
                style={{
                  margin: "0 0.5rem",
                  padding: "0.5rem 1rem",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: "0.8rem",
                  backgroundColor: activeProject === num ? "var(--primary-blue)" : "transparent",
                  color: activeProject === num ? "var(--neutral-white)" : "var(--text-muted)",
                  border: activeProject === num ? "1px solid var(--primary-blue)" : "1px solid var(--surface-card-border)",
                  borderRadius: "2px",
                  cursor: "pointer"
                }}
              >
                Project {num}
              </button>
            ))}
          </div>

          {/* User's Submission Section */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", background: "var(--surface-card)", border: "1px solid var(--surface-card-border)", borderRadius: "10px", boxShadow: "var(--card-shadow)" }}>
            <h3>Your Submission for Project {activeProject}</h3>

            {!profile ? (
              <p style={{ color: "var(--status-negative)" }}>
                <Link to="/profiles">Create a profile</Link> to submit projects.
              </p>
            ) : Number(balance) < 1 ? (
              <p style={{ color: "var(--status-negative)" }}>
                You need ≥1 CritCoin to submit projects.
              </p>
            ) : userSubmission && !editing ? (
              <div>
                <img
                  src={userSubmission.image}
                  alt={userSubmission.title}
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    height: "auto",
                    objectFit: "contain",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    backgroundColor: "var(--surface-muted)"
                  }}
                  onError={(e) => {
                    console.error("❌ Failed to load your submission image");
                    console.error("❌ Image URL:", e.target.src);
                    e.target.alt = "Image failed to load";
                  }}
                  onLoad={() => console.log("✅ Your submission image loaded successfully")}
                />
                <h4>{userSubmission.title}</h4>
                <p>{userSubmission.description}</p>
                <p><strong>Total Received:</strong> <span className="ledger-num">{userSubmission.totalReceived}</span> CritCoin</p>
                <button className="artistic-btn" onClick={() => setEditing(true)}>Edit Submission</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "1rem" }}>
                  <label>Project Image (phone photos welcome - max 10MB):</label><br />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    required={!userSubmission}
                    style={{ marginTop: "0.5rem" }}
                  />
                  {(imagePreview || (userSubmission?.image && !selectedImage)) && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <img
                        src={imagePreview || userSubmission.image}
                        alt="Preview"
                        style={{
                          width: "100%",
                          maxWidth: "300px",
                          height: "auto",
                          maxHeight: "400px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          border: "1px solid var(--surface-card-border)",
                          backgroundColor: "var(--surface-muted)"
                        }}
                        onError={(e) => {
                          console.error("❌ Failed to load preview image");
                          e.target.alt = "Preview failed to load";
                        }}
                      />
                    </div>
                  )}
                </div>

                <input
                  className="artistic-input"
                  name="title"
                  placeholder="Project Title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  style={{ marginBottom: "1rem" }}
                /><br />

                <textarea
                  className="artistic-input"
                  name="description"
                  placeholder="Materials (optional)"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  style={{ marginBottom: "1rem" }}
                /><br />

                <button className="artistic-btn" type="submit" style={{ marginRight: "1rem" }}>
                  {userSubmission ? "Update" : "Submit"} Project
                </button>

                {editing && (
                  <button className="artistic-btn" type="button" onClick={() => {
                    setEditing(false);
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}>
                    Cancel
                  </button>
                )}
              </form>
            )}
          </div>

          {/* All Submissions for Current Project */}
          <div>
            <h3>All Submissions - Project {activeProject}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
              {projects.map((project) => (
                <div key={project._id} style={{
                  border: "1px solid var(--surface-card-border)",
                  borderRadius: "10px",
                  padding: "1rem",
                  backgroundColor: "var(--surface-card)",
                  boxShadow: "var(--card-shadow)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                    {project.authorPhoto && (
                      <img
                        src={project.authorPhoto}
                        alt="Profile"
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          marginRight: "0.5rem"
                        }}
                        onError={(e) => {
                          console.error("❌ Failed to load author photo");
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <strong>{project.authorName}</strong>
                  </div>

                  <img
                    src={project.image}
                    alt={project.title}
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "400px",
                      objectFit: "contain",
                      borderRadius: "8px",
                      marginBottom: "1rem",
                      backgroundColor: "var(--surface-muted)"
                    }}
                    onError={(e) => {
                      console.error("❌ Failed to load project image");
                      console.error("❌ Image URL:", e.target.src);
                      e.target.style.display = 'none';
                      const placeholder = document.createElement('div');
                      placeholder.style.cssText = `
                        width: 100%;
                        height: 200px;
                        background-color: var(--surface-muted);
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--text-muted);
                        font-size: 1rem;
                        margin-bottom: 1rem;
                      `;
                      placeholder.textContent = '📷 Image not available';
                      e.target.parentNode.insertBefore(placeholder, e.target);
                    }}
                    onLoad={() => console.log("✅ Project image loaded:", project.title)}
                  />
                  
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                  <p><strong>Received:</strong> <span className="ledger-num">{project.totalReceived}</span> CritCoin</p>
                  
                  {wallet && project.authorWallet.toLowerCase() !== wallet.toLowerCase() && (
                    <div style={{ marginTop: "1rem" }}>
                      <input
                        className="artistic-input"
                        type="number"
                        placeholder="Amount"
                        value={sendAmounts[project._id] || ""}
                        onChange={(e) => setSendAmounts(prev => ({ ...prev, [project._id]: e.target.value }))}
                        min="1"
                        max={balance}
                        style={{ width: "96px", marginRight: "0.5rem", padding: "0.5rem", display: "inline-block" }}
                      />
                      <button
                        className="artistic-btn btn-coin"
                        onClick={() => handleSendCoin(project._id, project.authorWallet)}
                        style={{ padding: "0.5rem 1rem" }}
                      >
                        Send CritCoin
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}