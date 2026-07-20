import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBalance } from "../utils/balance";

const API = {
  predictions: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/predictions`
    : "http://localhost:3001/api/predictions",
  profiles: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/profiles`
    : "http://localhost:3001/api/profiles"
};

const PROJECTS = [2, 3, 4];

export default function Prediction() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [allProfiles, setAllProfiles] = useState([]);
  // Per-project state maps
  const [allPredictions, setAllPredictions] = useState({});     // { 2: [...], 3: [...], 4: [...] }
  const [userPredictions, setUserPredictions] = useState({});   // { 2: pred|null, 3: null, 4: null }
  const [selectedWallets, setSelectedWallets] = useState({});   // { 2: "", 3: "", 4: "" }
  const [submitting, setSubmitting] = useState({});             // { 2: false, 3: false, 4: false }
  const [predictionEnabled, setPredictionEnabled] = useState({ 2: true, 3: true, 4: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (wallet) {
      checkUserPredictions();
    }
  }, [wallet]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [profilesRes, p2Res, p3Res, p4Res, settingsRes] = await Promise.all([
        fetch(API.profiles),
        fetch(`${API.predictions}?project=2`),
        fetch(`${API.predictions}?project=3`),
        fetch(`${API.predictions}?project=4`),
        fetch(`${API.predictions}/settings`)
      ]);

      if (profilesRes.ok) setAllProfiles(await profilesRes.json());

      const predsMap = {};
      const results = await Promise.all([p2Res, p3Res, p4Res].map(r => r.ok ? r.json() : []));
      PROJECTS.forEach((p, i) => { predsMap[p] = results[i]; });
      setAllPredictions(predsMap);

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setPredictionEnabled({
          2: s.predictionEnabled2 !== false,
          3: s.predictionEnabled3 !== false,
          4: s.predictionEnabled4 !== false
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkUserPredictions = async () => {
    if (!wallet) return;
    try {
      const results = await Promise.all(
        PROJECTS.map(p =>
          fetch(`${API.predictions}/check/${wallet}?project=${p}`).then(r => r.json())
        )
      );
      const map = {};
      PROJECTS.forEach((p, i) => {
        map[p] = results[i].hasPrediction ? results[i].prediction : null;
      });
      setUserPredictions(map);
    } catch (err) {
      console.error("Error checking predictions:", err);
    }
  };

  const connectWallet = async () => {
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(addr);

      // Balance comes from the database ledger, not the chain.
      setBalance(await fetchBalance(addr));

      const res = await fetch(`${API.profiles}/${addr}`);
      if (res.ok) setProfile(await res.json());
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const handleSubmitPrediction = async (e, projectNum) => {
    e.preventDefault();
    const selectedWallet = selectedWallets[projectNum];

    if (!wallet || !profile) {
      alert("Please connect wallet and ensure you have a profile");
      return;
    }
    if (!selectedWallet) {
      alert("Please select a profile to predict");
      return;
    }

    const selectedProfile = allProfiles.find(p => p.wallet.toLowerCase() === selectedWallet.toLowerCase());
    const confirmed = window.confirm(
      `Are you sure you want to predict ${selectedProfile?.name || selectedWallet} for Project ${projectNum}?\n\n` +
      `WARNING: This prediction CANNOT be changed once submitted!`
    );
    if (!confirmed) return;

    setSubmitting(prev => ({ ...prev, [projectNum]: true }));

    try {
      const res = await fetch(API.predictions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictorWallet: wallet,
          predictedWallet: selectedWallet,
          projectNumber: projectNum
        })
      });

      if (res.ok) {
        const prediction = await res.json();
        setUserPredictions(prev => ({ ...prev, [projectNum]: prediction }));
        setSelectedWallets(prev => ({ ...prev, [projectNum]: "" }));
        fetchAllData();
      } else {
        const error = await res.json();
        alert("Failed to submit: " + (error.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Prediction submission error:", err);
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(prev => ({ ...prev, [projectNum]: false }));
    }
  };

  const getPredictionCounts = (projectNum) => {
    const counts = {};
    (allPredictions[projectNum] || []).forEach(pred => {
      const key = pred.predictedWallet.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const renderProjectSection = (projectNum) => {
    const isEnabled = predictionEnabled[projectNum];
    const userPred = userPredictions[projectNum];
    const predictions = allPredictions[projectNum] || [];
    const counts = getPredictionCounts(projectNum);

    return (
      <div key={projectNum} style={{
        marginBottom: '3rem',
        paddingBottom: '3rem',
        borderBottom: projectNum < 4 ? '2px solid var(--dark-border)' : 'none'
      }}>
        {/* Question header */}
        <div className="artistic-card" style={{
          textAlign: "center",
          marginBottom: "1.5rem",
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(249, 115, 22, 0.1))',
          border: '2px solid var(--primary-blue-light)'
        }}>
          <h2 style={{ fontFamily: 'Cinzel, serif', marginBottom: '0.5rem' }}>
            Project {projectNum}
          </h2>
          <p style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Who will earn the most CritCoin in Project {projectNum}?
          </p>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-orange)', marginBottom: '0.5rem' }}>
            Correct prediction reward: 1000 CritCoin
          </p>
          {!isEnabled && (
            <p style={{
              display: 'inline-block',
              background: 'rgba(220,53,69,0.15)',
              border: '1px solid #dc3545',
              color: '#dc3545',
              borderRadius: '6px',
              padding: '0.25rem 0.75rem',
              fontSize: '0.9rem'
            }}>
              Predictions are currently closed
            </p>
          )}
        </div>

        {/* User action area */}
        {wallet && (
          <>
            {!profile ? (
              <div className="artistic-card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--accent-orange)' }}>
                  You need a profile to make predictions. <Link to="/profiles">Create Profile</Link>
                </p>
              </div>
            ) : userPred ? (
              <div className="artistic-card" style={{
                textAlign: 'center',
                marginBottom: '1.5rem',
                background: 'rgba(22, 163, 74, 0.1)',
                border: '2px solid var(--complement-green)'
              }}>
                <h3 style={{ color: 'var(--complement-green)' }}>Your Prediction is Locked In!</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem' }}>
                  {userPred.predictedPhoto && (
                    <img
                      src={userPred.predictedPhoto}
                      alt={userPred.predictedName}
                      style={{ width: '55px', height: '55px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>{userPred.predictedName}</p>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                      Predicted on {new Date(userPred.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : isEnabled ? (
              <div className="artistic-card" style={{ marginBottom: '1.5rem' }}>
                <h3>Make Your Prediction</h3>
                <form onSubmit={(e) => handleSubmitPrediction(e, projectNum)}>
                  <select
                    value={selectedWallets[projectNum] || ""}
                    onChange={(e) => setSelectedWallets(prev => ({ ...prev, [projectNum]: e.target.value }))}
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
                    {allProfiles.map(p => (
                      <option key={p.wallet} value={p.wallet}>
                        {p.name} ({p.wallet.slice(0, 8)}...)
                      </option>
                    ))}
                  </select>
                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="submit"
                      className="artistic-btn"
                      disabled={submitting[projectNum] || !selectedWallets[projectNum]}
                      style={{ opacity: submitting[projectNum] ? 0.7 : 1 }}
                    >
                      {submitting[projectNum] ? 'Submitting...' : 'Submit Prediction (Final!)'}
                    </button>
                  </div>
                  <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--accent-orange)' }}>
                    Warning: Once submitted, your prediction cannot be changed!
                  </p>
                </form>
              </div>
            ) : null}
          </>
        )}

        {/* All profiles grid */}
        <div className="artistic-card">
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'Cinzel, serif' }}>
            All Profiles & Predictions ({predictions.length} / {allProfiles.length} submitted)
          </h3>
          {loading ? (
            <p style={{ textAlign: 'center' }}>Loading...</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.25rem'
            }}>
              {allProfiles.map(p => {
                const votesReceived = counts[p.wallet.toLowerCase()] || 0;
                const profilePred = predictions.find(
                  pred => pred.predictorWallet.toLowerCase() === p.wallet.toLowerCase()
                );

                return (
                  <div key={p._id} style={{
                    background: 'rgba(42, 42, 42, 0.8)',
                    border: '1px solid var(--dark-border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    position: 'relative'
                  }}>
                    {votesReceived > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        background: 'var(--gradient-secondary)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}>
                        {votesReceived}
                      </div>
                    )}

                    <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                      {p.photo ? (
                        <img
                          src={p.photo}
                          alt={p.name}
                          style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-blue-light)' }}
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      ) : (
                        <div style={{
                          width: '70px', height: '70px', borderRadius: '50%',
                          background: 'var(--gradient-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto', fontSize: '1.75rem'
                        }}>
                          {p.name?.charAt(0) || 'P'}
                        </div>
                      )}
                      <h4 style={{ marginTop: '0.5rem', marginBottom: '0.15rem' }}>{p.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{p.starSign}</p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--dark-elevated)', paddingTop: '0.75rem' }}>
                      {profilePred ? (
                        <div style={{ fontSize: '0.9rem' }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Predicted: </span>
                          <span style={{ color: 'var(--accent-orange-light)', fontWeight: 'bold' }}>
                            {profilePred.predictedName}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                          No prediction yet
                        </div>
                      )}
                      <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: votesReceived > 0 ? 'var(--complement-green)' : 'rgba(255,255,255,0.4)' }}>
                        {votesReceived} prediction{votesReceived !== 1 ? 's' : ''} received
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 className="gothic-title gothic-text" style={{ textAlign: "center" }}>
        Prediction Market
      </h1>

      {/* Wallet connection */}
      {!wallet && (
        <div className="artistic-card" style={{ textAlign: "center", padding: "2rem", marginBottom: "2rem" }}>
          <h3 className="royal-text">Connect Wallet to Participate</h3>
          <p style={{ marginBottom: "1.5rem", fontStyle: 'italic' }}>
            Connect your wallet to make predictions and see your picks
          </p>
          <button onClick={connectWallet} className="artistic-btn">Connect Wallet</button>
        </div>
      )}

      {wallet && (
        <div className="artistic-card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ margin: 0 }}>
            <strong>Connected:</strong> {profile?.name || wallet.slice(0, 10) + '...'}
            <span style={{ marginLeft: '1rem' }}>Balance: {balance} CritCoin</span>
          </p>
        </div>
      )}

      {/* One section per project */}
      {PROJECTS.map(renderProjectSection)}
    </div>
  );
}
