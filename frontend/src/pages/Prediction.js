import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import deployed from "../contracts/sepolia.json";

const API = {
  predictions: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/predictions`
    : "http://localhost:3001/api/predictions",
  profiles: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/profiles`
    : "http://localhost:3001/api/profiles"
};

export default function Prediction() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [allProfiles, setAllProfiles] = useState([]);
  const [allPredictions, setAllPredictions] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [userPrediction, setUserPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Check user's prediction when wallet connects
  useEffect(() => {
    if (wallet) {
      checkUserPrediction();
    }
  }, [wallet]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const profilesRes = await fetch(API.profiles);
      if (profilesRes.ok) {
        const profiles = await profilesRes.json();
        setAllProfiles(profiles);
      }

      // Fetch all predictions
      const predictionsRes = await fetch(API.predictions);
      if (predictionsRes.ok) {
        const predictions = await predictionsRes.json();
        setAllPredictions(predictions);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkUserPrediction = async () => {
    if (!wallet) return;

    try {
      const res = await fetch(`${API.predictions}/check/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasPrediction) {
          setUserPrediction(data.prediction);
        }
      }
    } catch (err) {
      console.error("Error checking prediction:", err);
    }
  };

  const connectWallet = async () => {
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(addr);

      // Get balance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(deployed.address, deployed.abi, provider);
      const bal = await contract.balanceOf(addr);
      setBalance(Number(bal.toString()));

      // Get user profile
      const res = await fetch(`${API.profiles}/${addr}`);
      if (res.ok) {
        const prof = await res.json();
        setProfile(prof);
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const handleSubmitPrediction = async (e) => {
    e.preventDefault();

    if (!wallet || !profile) {
      alert("Please connect wallet and ensure you have a profile");
      return;
    }

    if (!selectedWallet) {
      alert("Please select a profile to predict");
      return;
    }

    // Confirmation dialog - predictions are permanent!
    const selectedProfile = allProfiles.find(p => p.wallet.toLowerCase() === selectedWallet.toLowerCase());
    const confirmed = window.confirm(
      `Are you sure you want to predict ${selectedProfile?.name || selectedWallet}?\n\n` +
      `WARNING: This prediction CANNOT be changed once submitted!`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const res = await fetch(API.predictions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictorWallet: wallet,
          predictedWallet: selectedWallet
        })
      });

      if (res.ok) {
        const prediction = await res.json();
        setUserPrediction(prediction);
        alert("Prediction submitted successfully!");
        fetchAllData(); // Refresh all predictions
      } else {
        const error = await res.json();
        alert("Failed to submit prediction: " + (error.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Prediction submission error:", err);
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Build a map of how many predictions each person received
  const getPredictionCounts = () => {
    const counts = {};
    allPredictions.forEach(pred => {
      const key = pred.predictedWallet.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const predictionCounts = getPredictionCounts();

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 className="gothic-title gothic-text" style={{ textAlign: "center" }}>
        Prediction Market
      </h1>

      <div className="artistic-card" style={{
        textAlign: "center",
        marginBottom: "2rem",
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(249, 115, 22, 0.1))',
        border: '2px solid var(--primary-blue-light)'
      }}>
        <h2 style={{ fontFamily: 'Cinzel, serif', marginBottom: '1rem' }}>
          Who will earn the most CritCoin in Project 2?
        </h2>
        <p style={{
          fontSize: '1.3rem',
          fontWeight: 'bold',
          color: 'var(--accent-orange)',
          marginBottom: '0.5rem'
        }}>
          Correct prediction reward: 1000 CritCoin
        </p>
        <p style={{ fontFamily: 'Crimson Text, serif', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
          Make your prediction! Each user can only predict ONCE, and predictions cannot be changed.
        </p>
      </div>

      {/* Wallet Connection */}
      {!wallet ? (
        <div className="artistic-card" style={{ textAlign: "center", padding: "2rem" }}>
          <h3 className="royal-text">Connect Wallet to Participate</h3>
          <p style={{ marginBottom: "1.5rem", fontStyle: 'italic' }}>
            Connect your wallet to make a prediction and see all predictions
          </p>
          <button onClick={connectWallet} className="artistic-btn">
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {/* User Status */}
          <div className="artistic-card" style={{ marginBottom: "1.5rem" }}>
            <p>
              <strong>Connected:</strong> {profile?.name || wallet.slice(0, 10) + '...'}
              <span style={{ marginLeft: '1rem' }}>Balance: {balance} CritCoin</span>
            </p>
          </div>

          {/* Prediction Form or Status */}
          {!profile ? (
            <div className="artistic-card" style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <p style={{ color: 'var(--accent-orange)' }}>
                You need a profile to make predictions. <Link to="/profiles">Create Profile</Link>
              </p>
            </div>
          ) : userPrediction ? (
            <div className="artistic-card" style={{
              textAlign: 'center',
              marginBottom: '2rem',
              background: 'rgba(22, 163, 74, 0.1)',
              border: '2px solid var(--complement-green)'
            }}>
              <h3 style={{ color: 'var(--complement-green)' }}>Your Prediction is Locked In!</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                {userPrediction.predictedPhoto && (
                  <img
                    src={userPrediction.predictedPhoto}
                    alt={userPrediction.predictedName}
                    style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <div>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {userPrediction.predictedName}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    Predicted on {new Date(userPrediction.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="artistic-card" style={{ marginBottom: '2rem' }}>
              <h3>Make Your Prediction</h3>
              <form onSubmit={handleSubmitPrediction}>
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '1rem',
                    borderRadius: '8px',
                    border: '2px solid var(--dark-border)',
                    background: 'var(--dark-surface)',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">-- Select who will earn the most CritCoin --</option>
                  {allProfiles
                    .filter(p => p.wallet.toLowerCase() !== wallet.toLowerCase()) // Exclude self
                    .map(p => (
                      <option key={p.wallet} value={p.wallet}>
                        {p.name} ({p.wallet.slice(0, 8)}...)
                      </option>
                    ))}
                </select>
                <div style={{ textAlign: 'center' }}>
                  <button
                    type="submit"
                    className="artistic-btn"
                    disabled={submitting || !selectedWallet}
                    style={{ opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Prediction (Final!)'}
                  </button>
                </div>
                <p style={{
                  textAlign: 'center',
                  marginTop: '1rem',
                  fontSize: '0.9rem',
                  color: 'var(--accent-orange)'
                }}>
                  Warning: Once submitted, your prediction cannot be changed!
                </p>
              </form>
            </div>
          )}
        </>
      )}

      {/* All Profiles with Predictions Display */}
      <div className="artistic-card">
        <h2 style={{ marginBottom: '1.5rem', fontFamily: 'Cinzel, serif' }}>
          All Profiles & Predictions
        </h2>

        {loading ? (
          <p style={{ textAlign: 'center' }}>Loading...</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {allProfiles.map(profile => {
              const votesReceived = predictionCounts[profile.wallet.toLowerCase()] || 0;
              const profilePrediction = allPredictions.find(
                p => p.predictorWallet.toLowerCase() === profile.wallet.toLowerCase()
              );

              return (
                <div
                  key={profile._id}
                  style={{
                    background: 'rgba(42, 42, 42, 0.8)',
                    border: '1px solid var(--dark-border)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    position: 'relative'
                  }}
                >
                  {/* Votes Received Badge */}
                  {votesReceived > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      background: 'var(--gradient-secondary)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {votesReceived}
                    </div>
                  )}

                  {/* Profile Info */}
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    {profile.photo ? (
                      <img
                        src={profile.photo}
                        alt={profile.name}
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '3px solid var(--primary-blue-light)'
                        }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ) : (
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        fontSize: '2rem'
                      }}>
                        {profile.name?.charAt(0) || 'P'}
                      </div>
                    )}
                    <h4 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                      {profile.name}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                      {profile.starSign}
                    </p>
                  </div>

                  {/* This Person's Prediction */}
                  <div style={{
                    borderTop: '1px solid var(--dark-elevated)',
                    paddingTop: '1rem',
                    marginTop: '1rem'
                  }}>
                    {profilePrediction ? (
                      <div style={{ fontSize: '0.9rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Predicted: </span>
                        <span style={{ color: 'var(--accent-orange-light)', fontWeight: 'bold' }}>
                          {profilePrediction.predictedName}
                        </span>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255,255,255,0.4)',
                        fontStyle: 'italic'
                      }}>
                        No prediction yet
                      </div>
                    )}
                  </div>

                  {/* Votes Received Count */}
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    color: votesReceived > 0 ? 'var(--complement-green)' : 'rgba(255,255,255,0.4)'
                  }}>
                    {votesReceived} prediction{votesReceived !== 1 ? 's' : ''} received
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
