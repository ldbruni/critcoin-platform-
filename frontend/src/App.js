import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Dapp } from "./components/Dapp";
import Bounties from "./pages/Bounties";
import Profiles from "./pages/Profiles";
import FormPage from "./pages/FormPage";
import Projects from "./pages/Projects";
import Explorer from "./pages/Explorer";
import Admin from "./pages/Admin";

// Replace with your actual admin wallet address
const ADMIN_WALLET = process.env.REACT_APP_ADMIN_WALLET?.toLowerCase() || "0xc69c361d300aeaad0aee95bd1c753e62298f92e9";

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkWallet = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const currentWallet = accounts[0];
            setWallet(currentWallet);
            const isAdminWallet = currentWallet.toLowerCase() === ADMIN_WALLET;
            setIsAdmin(isAdminWallet);
            console.log('Initial wallet check:', currentWallet);
            console.log('Admin wallet expected:', ADMIN_WALLET);
            console.log('Is admin?', isAdminWallet);
          }
        } catch (error) {
          console.error("Error checking wallet:", error);
        }
      }
    };

    checkWallet();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          const currentWallet = accounts[0];
          setWallet(currentWallet);
          const isAdminWallet = currentWallet.toLowerCase() === ADMIN_WALLET;
          setIsAdmin(isAdminWallet);
          console.log('Wallet connected:', currentWallet);
          console.log('Admin wallet expected:', ADMIN_WALLET);
          console.log('Is admin?', isAdminWallet);
        } else {
          setWallet(null);
          setIsAdmin(false);
        }
      });
    }
  }, []);

  return (
    <Router>
      <nav style={{ 
        padding: "1rem", 
        borderBottom: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem"
      }}>
        <div style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          justifyContent: "center",
          alignItems: "center", 
          gap: "0.5rem",
          width: "100%"
        }}>
          {/* First row - main navigation */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.5rem",
            justifyContent: "center",
            flexWrap: "wrap"
          }}>
            <Link to="/" style={{ textDecoration: "none", padding: "0.25rem 0.5rem" }}>🏠 Home</Link>
            <span>|</span>
            <Link to="/profiles" style={{ textDecoration: "none", padding: "0.25rem 0.5rem" }}>👤 Profiles</Link>
            <span>|</span>
            <Link to="/projects" style={{ textDecoration: "none", padding: "0.25rem 0.5rem" }}>🎨 Projects</Link>
            <span>|</span>
            <Link to="/explorer" style={{ textDecoration: "none", padding: "0.25rem 0.5rem" }}>🔍 Explorer</Link>
          </div>
          
          {/* Second row - secondary navigation */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.5rem",
            justifyContent: "center",
            width: "100%",
            marginTop: "0.25rem"
          }}>
            <Link to="/forum" style={{ textDecoration: "none", padding: "0.25rem 0.5rem" }}>💬 Forum</Link>
            <span>|</span>
            <Link to="/bounties" style={{ textDecoration: "none", padding: "0.25rem 0.5rem" }}>🎯 Bounties</Link>
            {isAdmin && (
              <>
                <span>|</span>
                <Link to="/admin" style={{ 
                  color: "#dc3545", 
                  fontWeight: "bold", 
                  textDecoration: "none", 
                  padding: "0.25rem 0.5rem" 
                }}>
                  🛡️ Admin
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Dapp />} />
        <Route path="/bounties" element={<Bounties />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/forum" element={<FormPage />} />
      </Routes>
    </Router>
  );
}
