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
      <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
        <Link to="/" style={{ marginRight: "1rem" }}>Home</Link>
        <Link to="/bounties" style={{ marginRight: "1rem" }}>Bounties</Link>
        <Link to="/profiles" style={{ marginRight: "1rem" }}>Profiles</Link>
        <Link to="/projects" style={{ marginRight: "1rem" }}>Projects</Link>
        <Link to="/explorer" style={{ marginRight: "1rem" }}>Explorer</Link>
        <Link to="/forum" style={{ marginRight: "1rem" }}>Forum</Link>
        {isAdmin && <Link to="/admin" style={{ color: "#dc3545", fontWeight: "bold" }}>🛡️ Admin</Link>}
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
