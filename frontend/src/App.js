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
import Feed from "./pages/Feed";
import ThemeScope from "./theme/ThemeScope";
import { fetchPageVisibility, isPageVisible, setViewerWallet } from "./utils/pageVisibility";
// Order matters, and so does the fact that index.js imports this module before
// bootstrap.css: the theme rules must keep landing ahead of bootstrap so it
// wins the same element-selector ties it wins today. See styles/TOKENS.md.
import './styles/base.css';
import './styles/theme-rules.css';
import './styles/theme-v1.css';
import './styles/theme-v2.css';

// Replace with your actual admin wallet address
const ADMIN_WALLET = process.env.REACT_APP_ADMIN_WALLET?.toLowerCase() || "0xc69c361d300aeaad0aee95bd1c753e62298f92e9";

function Navigation({ isAdmin, visibility }) {
  const location = useLocation();

  // A toggleable page's link shows once visibility is known, unless the admin
  // has hidden it. The admin always sees it.
  const showLink = (page) => isAdmin || (visibility && isPageVisible(visibility, page));

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
        {showLink('feed') && (
          <Link to="/feed" className={`nav-link ${isActive('/feed') ? 'active' : ''}`}>Feed</Link>
        )}
        <Link to="/bounties" className={`nav-link ${isActive('/bounties') ? 'active' : ''}`}>Bounties</Link>
        {showLink('prediction') && (
          <Link to="/prediction" className={`nav-link ${isActive('/prediction') ? 'active' : ''}`}>Prediction</Link>
        )}
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

// A toggleable page. Hidden from students, it shows a short notice in place of
// the page; the admin still gets the page, labelled so they know students
// can't see it. Nothing is rendered until visibility is known, so a hidden
// page never flashes.
function PageGate({ page, visibility, isAdmin, children }) {
  if (!visibility) return null;
  if (isPageVisible(visibility, page)) return children;

  if (!isAdmin) {
    return (
      <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div className="artistic-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", marginBottom: "0.5rem" }}>This page isn't available yet</h2>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Check back once it's been introduced in class.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ maxWidth: "1200px", margin: "1rem auto 0", padding: "0 2rem" }}>
        <span style={{
          display: "inline-block",
          padding: "0.3rem 0.75rem",
          backgroundColor: "var(--tint-warning)",
          border: "1px solid var(--status-warning)",
          color: "var(--status-warning)",
          borderRadius: "4px",
          fontSize: "0.8rem",
          fontWeight: 600
        }}>
          Hidden from students
        </span>
      </div>
      {children}
    </>
  );
}

// Everything inside the Router. Visibility is re-read on every navigation, so
// an admin's toggle reaches students on their next click, with no redeploy.
function AppShell({ isAdmin }) {
  const location = useLocation();
  const [visibility, setVisibility] = useState(null);

  useEffect(() => {
    fetchPageVisibility()
      .then(data => setVisibility(data.visibility))
      .catch(err => {
        console.error("Page visibility fetch error:", err);
        setVisibility(prev => prev || {}); // unknown pages default to visible
      });
  }, [location.pathname]);

  // Every live route renders under a v2 page-level scope. The chrome gets its
  // own sibling v2 scope. Archive is deliberately absent here: it owns its
  // scope so its Classic Mode toggle can switch that page (and only that page)
  // to v1 while the chrome stays v2. It also ignores page visibility: archived
  // semesters show their Prediction and Feed content regardless.
  const pageV2 = (element) => (
    <ThemeScope theme="v2" pageLevel>
      {element}
    </ThemeScope>
  );
  const gated = (page, element) => pageV2(
    <PageGate page={page} visibility={visibility} isAdmin={isAdmin}>{element}</PageGate>
  );

  return (
    <>
      <ThemeScope theme="v2">
        <Navigation isAdmin={isAdmin} visibility={visibility} />
      </ThemeScope>
      <Routes>
        <Route path="/" element={pageV2(<Dapp />)} />
        <Route path="/bounties" element={pageV2(<Bounties />)} />
        <Route path="/profiles" element={pageV2(<Profiles />)} />
        <Route path="/projects" element={pageV2(<Projects />)} />
        <Route path="/leaderboard" element={pageV2(<Leaderboard />)} />
        <Route path="/explorer" element={pageV2(<Explorer />)} />
        <Route path="/admin" element={pageV2(<Admin />)} />
        <Route path="/forum" element={pageV2(<FormPage />)} />
        <Route path="/feed" element={gated("feed", <Feed />)} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/:archiveId" element={<Archive />} />
        <Route path="/prediction" element={gated("prediction", <Prediction />)} />
      </Routes>
    </>
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
            setViewerWallet(currentWallet);
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
          setViewerWallet(currentWallet);
          const isAdminWallet = currentWallet.toLowerCase() === ADMIN_WALLET;
          setIsAdmin(isAdminWallet);
          console.log('Wallet connected:', currentWallet);
          console.log('Admin wallet expected:', ADMIN_WALLET);
          console.log('Is admin?', isAdminWallet);
        } else {
          setWallet(null);
          setViewerWallet(null);
          setIsAdmin(false);
        }
      });
    }
  }, []);

  return (
    <Router>
      <AppShell isAdmin={isAdmin} />
    </Router>
  );
}
