// Admin-only on-chain balance readout, shown in the nav on every page.
//
// This is the deliberate, narrowly-scoped exception to "no balanceOf in the app":
// it shows the ADMIN/deployer wallet's LIVE ON-CHAIN CritCoin and Sepolia ETH -
// the operational gauge for the wallet that actually moves tokens before a deploy
// or grant. It is NOT a student-style database balance and is clearly labelled
// on-chain so it is never mistaken for one. Student balances stay database-only.
//
// It renders only for the admin wallet, and only fetches once the admin already
// has a session (hasSession) so it never triggers an unprompted signature. Values
// come from the admin-only GET /api/admin/onchain endpoint (fail-closed
// middleware), never a public route, and degrade to "unavailable" when the RPC is
// down - it never throws or blanks the page.

import React, { useEffect, useState, useCallback } from "react";
import { authorizedFetch, hasSession } from "../utils/auth";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";
const REFRESH_MS = 60 * 1000;

function shortWallet(w) {
  return w ? `${w.slice(0, 6)}…${w.slice(-4)}` : "";
}

export default function AdminOnChainStatus({ wallet, isAdmin }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ready | unavailable

  const load = useCallback(async () => {
    // Only the admin sees this, and only once they have signed in this session -
    // otherwise we would prompt for a signature on every page load.
    if (!isAdmin || !wallet || !hasSession(wallet)) {
      setState("idle");
      setData(null);
      return;
    }
    try {
      setState((s) => (s === "ready" ? s : "loading"));
      const res = await authorizedFetch(`${API_BASE}/api/admin/onchain/${wallet}`, {}, wallet);
      if (!res.ok) {
        setState("unavailable");
        return;
      }
      const json = await res.json();
      setData(json);
      setState(json.available ? "ready" : "unavailable");
    } catch (e) {
      // Never let a failed readout take down the page.
      setState("unavailable");
    }
  }, [wallet, isAdmin]);

  useEffect(() => {
    load();
    if (!isAdmin || !wallet) return undefined;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load, isAdmin, wallet]);

  // Never render for non-admin wallets.
  if (!isAdmin) return null;
  // Before the admin signs in this session there is nothing to show yet.
  if (state === "idle") return null;

  const label = (text) => (
    <div className="admin-onchain-readout" title="Live on-chain balances of the admin/deployer wallet (not a database balance)" style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.25rem 0.75rem",
      margin: "0.25rem auto 0",
      fontSize: "0.8rem",
      lineHeight: 1.3,
      color: "var(--text-muted, #9aa)",
      background: "var(--surface-muted, rgba(255,255,255,0.05))",
      border: "1px solid var(--surface-card-border, rgba(255,255,255,0.1))",
      borderRadius: "999px",
      whiteSpace: "nowrap",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }}>
      {text}
    </div>
  );

  if (state === "loading") {
    return label(<span>on-chain balances…</span>);
  }

  if (state === "unavailable") {
    return label(<span>⛓️ on-chain balance unavailable</span>);
  }

  const crit = data?.critBalance;
  const eth = data?.ethBalance;
  const ethDisplay = eth === null || eth === undefined ? "—" : `${Number(eth).toFixed(4)} ETH`;
  return label(
    <span>
      ⛓️ <strong>Admin wallet on-chain</strong> ({shortWallet(data?.wallet)}):{" "}
      {crit === null || crit === undefined ? "—" : `${crit} CRIT`} · {ethDisplay} <span style={{ opacity: 0.7 }}>gas</span>
    </span>
  );
}
