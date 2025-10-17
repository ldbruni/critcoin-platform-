// src/pages/Projects.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

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
  const [sendAmount, setSendAmount] = useState("");

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
      formData.append('balance', balance);
      
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
    if (!wallet || !sendAmount || Number(sendAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (Number(sendAmount) > Number(balance)) {
      alert("Insufficient balance");
      return;
    }

    if (recipientWallet.toLowerCase() === wallet.toLowerCase()) {
      alert("You cannot send CritCoin to yourself");
      return;
    }

    try {
      // In a real implementation, you'd interact with the smart contract here
      const res = await fetch(`${API.projects}/send-coin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWallet: wallet,
          toWallet: recipientWallet,
          amount: Number(sendAmount),
          projectId
        })
      });

      if (res.ok) {
        alert(`Successfully sent ${sendAmount} CritCoin!`);
        setSendAmount("");
        fetchProjects();
        // Refresh balance (in real implementation)
      } else {
        const errorText = await res.text();
        alert("Failed to send CritCoin: " + errorText);
      }
    } catch (err) {
      console.error("Send coin error:", err);
      alert("Error sending CritCoin. Check console.");
    }
  };

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 className="gothic-title gothic-text">Projects</h1>

      {!wallet ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p><strong>{profile?.name || wallet}</strong> — {balance} CritCoin</p>

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
                  backgroundColor: activeProject === num ? "#007bff" : "#f8f9fa",
                  color: activeProject === num ? "white" : "black",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Project {num}
              </button>
            ))}
          </div>

          {/* User's Submission Section */}
          <div style={{ marginBottom: "2rem", padding: "1rem", border: "2px solid #007bff", borderRadius: "8px" }}>
            <h3>Your Submission for Project {activeProject}</h3>
            
            {!profile ? (
              <p style={{ color: "red" }}>
                <Link to="/profiles">Create a profile</Link> to submit projects.
              </p>
            ) : Number(balance) < 1 ? (
              <p style={{ color: "red" }}>
                You need ≥1 CritCoin to submit projects.
              </p>
            ) : userSubmission && !editing ? (
              <div>
                <img
                  src={`${API.projects}/image/${userSubmission.image}`}
                  alt={userSubmission.title}
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    height: "auto",
                    objectFit: "contain",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    backgroundColor: "#f0f0f0"
                  }}
                  onError={(e) => {
                    console.error("❌ Failed to load your submission image:", userSubmission.image);
                    console.error("❌ Image URL:", e.target.src);
                    e.target.alt = "Image failed to load";
                  }}
                  onLoad={() => console.log("✅ Your submission image loaded:", userSubmission.image)}
                />
                <h4>{userSubmission.title}</h4>
                <p>{userSubmission.description}</p>
                <p><strong>Total Received:</strong> {userSubmission.totalReceived} CritCoin</p>
                <button onClick={() => setEditing(true)}>Edit Submission</button>
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
                        src={imagePreview || `${API.projects}/image/${userSubmission.image}`}
                        alt="Preview"
                        style={{
                          width: "100%",
                          maxWidth: "300px",
                          height: "auto",
                          maxHeight: "400px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          border: "2px solid #ddd",
                          backgroundColor: "#f0f0f0"
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
                  name="title"
                  placeholder="Project Title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
                /><br />
                
                <textarea
                  name="description"
                  placeholder="Project Description (optional)"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
                /><br />
                
                <button type="submit" style={{ marginRight: "1rem" }}>
                  {userSubmission ? "Update" : "Submit"} Project
                </button>
                
                {editing && (
                  <button type="button" onClick={() => {
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
                  border: "1px solid #ddd", 
                  borderRadius: "8px", 
                  padding: "1rem",
                  backgroundColor: "#f9f9f9"
                }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                    {project.authorPhoto && (
                      <img
                        src={`${API.profiles}/photo/${project.authorPhoto}`}
                        alt="Profile"
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          marginRight: "0.5rem"
                        }}
                      />
                    )}
                    <strong>{project.authorName}</strong>
                  </div>
                  
                  <img
                    src={`${API.projects}/image/${project.image}`}
                    alt={project.title}
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "400px",
                      objectFit: "contain",
                      borderRadius: "8px",
                      marginBottom: "1rem",
                      backgroundColor: "#f0f0f0"
                    }}
                    onError={(e) => {
                      console.error("❌ Failed to load project image:", project.image);
                      console.error("❌ Image URL:", e.target.src);
                      e.target.style.display = 'none';
                      const placeholder = document.createElement('div');
                      placeholder.style.cssText = `
                        width: 100%;
                        height: 200px;
                        background-color: #f0f0f0;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #999;
                        font-size: 1rem;
                        margin-bottom: 1rem;
                      `;
                      placeholder.textContent = '📷 Image not available';
                      e.target.parentNode.insertBefore(placeholder, e.target);
                    }}
                    onLoad={() => console.log("✅ Project image loaded:", project.image)}
                  />
                  
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                  <p><strong>Received:</strong> {project.totalReceived} CritCoin</p>
                  
                  {wallet && project.authorWallet.toLowerCase() !== wallet.toLowerCase() && (
                    <div style={{ marginTop: "1rem" }}>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        min="1"
                        max={balance}
                        style={{ width: "80px", marginRight: "0.5rem" }}
                      />
                      <button 
                        onClick={() => handleSendCoin(project._id, project.authorWallet)}
                        style={{
                          backgroundColor: "#28a745",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
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