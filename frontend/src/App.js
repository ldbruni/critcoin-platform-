import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Dapp } from "./components/Dapp";
import Bounties from "./pages/Bounties";
import Profiles from "./pages/Profiles";
import FormPage from "./pages/FormPage";
import Projects from "./pages/Projects";
import Explorer from "./pages/Explorer";
import Admin from "./pages/Admin";
import Leaderboard from "./pages/Leaderboard";
import './styles/artistic.css';

// Replace with your actual admin wallet address
const ADMIN_WALLET = process.env.REACT_APP_ADMIN_WALLET?.toLowerCase() || "0xc69c361d300aeaad0aee95bd1c753e62298f92e9";

function Navigation({ isAdmin }) {
  const location = useLocation();
  
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };
  
  return (
    <nav className="artistic-nav">
      <div className="nav-row">
        <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
        <Link to="/profiles" className={`nav-link ${isActive('/profiles') ? 'active' : ''}`}>Profiles</Link>
        <Link to="/projects" className={`nav-link ${isActive('/projects') ? 'active' : ''}`}>Projects</Link>
        <Link to="/leaderboard" className={`nav-link ${isActive('/leaderboard') ? 'active' : ''}`}>Leaderboard</Link>
      </div>
      <div className="nav-row">
        <Link to="/explorer" className={`nav-link ${isActive('/explorer') ? 'active' : ''}`}>Explorer</Link>
        <Link to="/forum" className={`nav-link ${isActive('/forum') ? 'active' : ''}`}>Forum</Link>
        <Link to="/bounties" className={`nav-link ${isActive('/bounties') ? 'active' : ''}`}>Bounties</Link>
        {isAdmin && (
          <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`} style={{
            background: 'linear-gradient(135deg, #ff6600, #ff0080)',
            color: 'white',
            fontWeight: 'bold'
          }}>
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}

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
      <Navigation isAdmin={isAdmin} />
      <Routes>
        <Route path="/" element={<Dapp />} />
        <Route path="/bounties" element={<Bounties />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/forum" element={<FormPage />} />
      </Routes>
    </Router>
  );
}
