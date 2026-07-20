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
import Archive from "./pages/Archive";
import Prediction from "./pages/Prediction";
import ThemeScope from "./theme/ThemeScope";
// Order matters, and so does the fact that index.js imports this module before
// bootstrap.css: the theme rules must keep landing ahead of bootstrap so it
// wins the same element-selector ties it wins today. See styles/TOKENS.md.
import './styles/base.css';
import './styles/theme-rules.css';
import './styles/theme-v1.css';
import './styles/theme-v2.css';

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
        <Link to="/prediction" className={`nav-link ${isActive('/prediction') ? 'active' : ''}`}>Prediction</Link>
        <Link to="/archive" className={`nav-link ${isActive('/archive') ? 'active' : ''}`}>Archive</Link>
        {isAdmin && (
          <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`} style={{
            background: 'var(--admin-link-bg, linear-gradient(135deg, #ff6600, #ff0080))',
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

  // One page-level scope per route. The chrome gets its own sibling scope so
  // it can be themed independently of the page below it — that is what lets a
  // Classic Mode archive page sit under v2 chrome. Archive is deliberately
  // absent here: it owns its scope so its toggle can switch it.
  const page = (element) => (
    <ThemeScope theme="v1" pageLevel>
      {element}
    </ThemeScope>
  );

  // Pages flip to v2 as they are converted (one commit per page). The rest stay
  // v1 until their turn. The nav chrome is v2 for everyone once it is converted.
  const pageV2 = (element) => (
    <ThemeScope theme="v2" pageLevel>
      {element}
    </ThemeScope>
  );

  return (
    <Router>
      <ThemeScope theme="v2">
        <Navigation isAdmin={isAdmin} />
      </ThemeScope>
      <Routes>
        <Route path="/" element={page(<Dapp />)} />
        <Route path="/bounties" element={pageV2(<Bounties />)} />
        <Route path="/profiles" element={page(<Profiles />)} />
        <Route path="/projects" element={pageV2(<Projects />)} />
        <Route path="/leaderboard" element={pageV2(<Leaderboard />)} />
        <Route path="/explorer" element={pageV2(<Explorer />)} />
        <Route path="/admin" element={page(<Admin />)} />
        <Route path="/forum" element={page(<FormPage />)} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/:archiveId" element={<Archive />} />
        <Route path="/prediction" element={pageV2(<Prediction />)} />
      </Routes>
    </Router>
  );
}
