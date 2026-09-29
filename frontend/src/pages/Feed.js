// src/pages/Feed.js
// The Feed: a high-volume posting exercise. Posts appear without names - the
// feed API never sends an author - and each poster sees their own count
// against the daily quota.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import FeedGrid, { FeedPostViewer } from "../components/FeedGrid";

const API = {
  feed: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/feed` : "http://localhost:3001/api/feed"
};

const PAGE_SIZE = 24;
const MAX_IMAGES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 2000;
// The server accepts a signature for 12h; refresh a little before that.
const AUTH_REUSE_MS = 11 * 60 * 60 * 1000;

const authKey = (wallet) => `critcoin-feed-auth:${wallet.toLowerCase()}`;

function readCachedAuth(wallet) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(authKey(wallet)) || "null");
    if (cached && Date.now() - cached.issuedAt < AUTH_REUSE_MS) return cached;
  } catch (e) { /* storage unavailable */ }
  return null;
}

function writeCachedAuth(wallet, auth) {
  try {
    if (auth) sessionStorage.setItem(authKey(wallet), JSON.stringify(auth));
    else sessionStorage.removeItem(authKey(wallet));
  } catch (e) { /* storage unavailable */ }
}

function QuotaPanel({ quota, onReveal, revealing }) {
  const box = {
    marginBottom: "1.5rem",
    padding: "1.25rem",
    background: "var(--surface-card)",
    border: "1px solid var(--surface-card-border)",
    borderRadius: "3px"
  };

  if (!quota) {
    return (
      <div style={{ ...box, display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="v2-kicker" style={{ border: "none", padding: 0, margin: 0 }}>Your count</div>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Sign with your wallet to see your posts and today's count. Signing is free - it proves the count is yours, and is not a transaction.
          </p>
        </div>
        <button className="artistic-btn" onClick={onReveal} disabled={revealing}>
          {revealing ? "Waiting for signature…" : "Show my count"}
        </button>
      </div>
    );
  }

  const { today, run, dailyTarget, runDays, dayOfRun, runStatus, runStart } = quota;
  const pct = Math.min(100, Math.round((today / dailyTarget) * 100));
  const met = today >= dailyTarget;
  const runLine = {
    active: `day ${dayOfRun} of ${runDays}`,
    upcoming: `run starts ${runStart}`,
    ended: "run ended",
    unscheduled: "no run scheduled"
  }[runStatus];

  return (
    <div style={box} aria-live="polite">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.35rem 1rem" }}>
        <div>
          <span className="ledger-num" style={{ fontSize: "2.4rem", fontWeight: 700, color: met ? "var(--status-positive)" : "var(--text)" }}>
            {today}
          </span>
          <span className="ledger-num" style={{ fontSize: "1.3rem", color: "var(--text-muted)" }}> / {dailyTarget}</span>
          <span style={{ marginLeft: "0.5rem", color: "var(--text-muted)" }}>today</span>
        </div>
        <div className="ledger-num" style={{ color: "var(--accent-orange)", fontSize: "0.95rem" }}>
          {runLine}
          {" · "}
          {runStatus === "unscheduled"
            ? `${run} total`
            : `${run} / ${dailyTarget * runDays} this run`}
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={dailyTarget}
        aria-valuenow={today}
        aria-label="Posts today"
        style={{ marginTop: "0.75rem", height: "6px", background: "var(--surface-muted)", borderRadius: "1px", overflow: "hidden" }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: met ? "var(--status-positive)" : "var(--primary-blue)", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function Composer({ wallet, onPosted }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over 10MB`);
      return;
    }
    const next = [...files, ...picked].slice(0, MAX_IMAGES);
    if (files.length + picked.length > MAX_IMAGES) setError(`At most ${MAX_IMAGES} images per post`);
    else setError("");
    setFiles(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setPosting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("wallet", wallet);
      form.append("text", text.trim());
      files.forEach((f) => form.append("images", f));
      const res = await fetch(API.feed, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Post failed");
      setText("");
      setFiles([]);
      onPosted(body.post);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{
      marginBottom: "2rem",
      padding: "1.25rem",
      background: "var(--surface-card)",
      border: "1px solid var(--surface-card-border)",
      borderRadius: "3px"
    }}>
      <h3 style={{ marginTop: 0 }}>New post</h3>
      <textarea
        className="artistic-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Caption, prompt, or text post"
        maxLength={MAX_TEXT}
        rows={3}
        style={{ width: "100%", marginBottom: "0.75rem" }}
      />
      {previews.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {previews.map((p, i) => (
            <div key={p.url} style={{ position: "relative", width: "84px", height: "84px", background: "var(--surface-muted)", border: "1px solid var(--surface-card-border)" }}>
              <img
                src={p.url}
                alt={p.file.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                // Most browsers cannot preview HEIC; the server still converts it.
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: "0.2rem", fontSize: "0.6rem", color: "var(--text-muted)", wordBreak: "break-all", pointerEvents: "none" }}>
                {/\.(heic|heif)$/i.test(p.file.name) ? p.file.name : ""}
              </span>
              <button
                type="button"
                aria-label={`Remove ${p.file.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer", lineHeight: 1, padding: "0.15rem 0.3rem" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={handleFiles}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="artistic-btn"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_IMAGES || posting}
        >
          Add images ({files.length}/{MAX_IMAGES})
        </button>
        <button
          type="submit"
          className="artistic-btn btn-coin"
          disabled={posting || (!text.trim() && files.length === 0)}
        >
          {posting ? "Posting…" : "Post"}
        </button>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Phone photos welcome, up to 10MB each. Your name is not shown on the feed.
        </span>
      </div>
      {error && <p role="alert" style={{ color: "var(--status-negative)", margin: "0.75rem 0 0" }}>{error}</p>}
    </form>
  );
}

export default function Feed() {
  const [wallet, setWallet] = useState(null);
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mine, setMine] = useState(null); // { posts, quota } once signed
  const [revealing, setRevealing] = useState(false);
  const [view, setView] = useState("feed");
  const [open, setOpen] = useState(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const closeViewer = useCallback(() => setOpen(null), []);
  const mineIds = useMemo(() => new Set((mine?.posts || []).map((p) => p._id)), [mine]);

  const loadPage = useCallback(async (cursor) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingPage(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE });
      if (cursor) params.set("before", cursor);
      const res = await fetch(`${API.feed}?${params}`);
      if (!res.ok) throw new Error("Failed to load the feed");
      const body = await res.json();
      setPosts((prev) => {
        const base = cursor ? prev : [];
        const seen = new Set(base.map((p) => p._id));
        return [...base, ...body.posts.filter((p) => !seen.has(p._id))];
      });
      setNextCursor(body.nextCursor);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      loadingRef.current = false;
      setLoadingPage(false);
    }
  }, []);

  const loadMine = useCallback(async (address, auth) => {
    const res = await fetch(`${API.feed}/mine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, ...auth })
    });
    if (res.status === 401) {
      writeCachedAuth(address, null);
      setMine(null);
      return;
    }
    if (res.ok) setMine(await res.json());
  }, []);

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    const adopt = (accounts) => {
      const address = accounts[0] || null;
      setWallet(address);
      setMine(null);
      setView("feed");
      const cached = address && readCachedAuth(address);
      if (cached) loadMine(address, cached).catch(() => {});
    };
    window.ethereum.request({ method: "eth_accounts" }).then(adopt).catch(() => {});
    window.ethereum.on("accountsChanged", adopt);
    return () => window.ethereum.removeListener?.("accountsChanged", adopt);
  }, [loadMine]);

  // Infinite scroll: fetch the next page as the end of the grid approaches.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor || view !== "feed") return undefined;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadPage(nextCursor); },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, view, loadPage]);

  const connectWallet = async () => {
    try {
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(address);
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const reveal = async () => {
    if (!wallet) return;
    setRevealing(true);
    try {
      const issuedAt = Date.now();
      const message = JSON.stringify({
        purpose: "critcoin-feed-mine",
        note: "Sign to see your own Feed posts and count. This is not a transaction.",
        wallet: wallet.toLowerCase(),
        issuedAt
      });
      const signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();
      const signature = await signer.signMessage(message);
      const auth = { message, signature, issuedAt };
      writeCachedAuth(wallet, auth);
      await loadMine(wallet, auth);
    } catch (err) {
      if (err.code !== 4001 && err.code !== "ACTION_REJECTED") console.error("Sign error:", err);
    } finally {
      setRevealing(false);
    }
  };

  const onPosted = (post) => {
    setPosts((prev) => [post, ...prev]);
    const cached = readCachedAuth(wallet);
    if (cached) loadMine(wallet, cached).catch(() => {});
  };

  const shown = view === "mine" ? (mine?.posts || []) : posts;

  const tabStyle = (active) => ({
    marginRight: "0.5rem",
    padding: "0.45rem 1rem",
    fontFamily: "var(--font-heading)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontSize: "0.8rem",
    backgroundColor: active ? "var(--primary-blue)" : "transparent",
    color: active ? "var(--neutral-white)" : "var(--text-muted)",
    border: active ? "1px solid var(--primary-blue)" : "1px solid var(--surface-card-border)",
    borderRadius: "2px",
    cursor: "pointer"
  });

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div className="v2-masthead">
        <div className="v2-kicker">CritCoin · The Feed</div>
        <h1 className="gothic-title gothic-text">The Feed</h1>
        <p style={{ color: "var(--text-muted)", margin: "0.5rem 0 0" }}>
          Everyone's posts, shown without names.
        </p>
      </div>

      {!window.ethereum ? null : !wallet ? (
        <div style={{ marginBottom: "2rem" }}>
          <button className="artistic-btn" onClick={connectWallet}>Connect Wallet to post</button>
        </div>
      ) : (
        <>
          <QuotaPanel quota={mine?.quota} onReveal={reveal} revealing={revealing} />
          <Composer wallet={wallet} onPosted={onPosted} />
        </>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <button type="button" style={tabStyle(view === "feed")} onClick={() => setView("feed")}>Feed</button>
        {wallet && (
          <button
            type="button"
            style={tabStyle(view === "mine")}
            onClick={() => { setView("mine"); if (!mine) reveal(); }}
          >
            My posts{mine ? ` (${mine.posts.length})` : ""}
          </button>
        )}
      </div>

      {view === "mine" && !mine ? (
        <p style={{ color: "var(--text-muted)" }}>Sign with your wallet to see your posts.</p>
      ) : shown.length === 0 && !loadingPage ? (
        <p style={{ color: "var(--text-muted)" }}>
          {loadError || (view === "mine" ? "You haven't posted yet." : "No posts yet.")}
        </p>
      ) : (
        <FeedGrid posts={shown} mineIds={mineIds} onOpen={setOpen} />
      )}

      {view === "feed" && (
        <div ref={sentinelRef} style={{ padding: "1.5rem 0", textAlign: "center" }}>
          {loadingPage ? (
            <span style={{ color: "var(--text-muted)" }}>Loading…</span>
          ) : loadError && posts.length > 0 ? (
            <button className="artistic-btn" onClick={() => loadPage(nextCursor)}>Retry</button>
          ) : nextCursor ? (
            <button className="artistic-btn" onClick={() => loadPage(nextCursor)}>Load more</button>
          ) : null}
        </div>
      )}

      <FeedPostViewer post={open} mine={open && mineIds.has(open._id)} onClose={closeViewer} />
    </div>
  );
}
