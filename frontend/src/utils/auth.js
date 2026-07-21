// Wallet sessions (Sign-In With Ethereum) for the frontend.
//
// One signature prompt per session: the wallet signs a server-issued nonce once,
// receives a short-lived bearer token, and that token authorizes every
// state-changing request until it expires. Identity is proven to the server by
// the token, never by a wallet address in the request body.
//
// Usage:
//   import { authorizedFetch, ensureSession, clearSession } from "../utils/auth";
//   const res = await authorizedFetch(url, { method: "POST", ... }, wallet);
//
// See SECURITY.md for the model.

import { ethers } from "ethers";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";
const STORAGE_PREFIX = "critcoin_session_";

// In-flight sign-in promises, keyed by wallet, so several requests that fire at
// once share a single MetaMask prompt instead of racing (which is what made the
// old admin panel show an error while still "working").
const pendingSignIn = {};

function storageKey(wallet) {
  return STORAGE_PREFIX + wallet.toLowerCase();
}

function readStored(wallet) {
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Treat a token in its last minute as expired to avoid mid-request expiry.
    if (!parsed.token || !parsed.expiresAt || Date.now() > parsed.expiresAt - 60_000) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearSession(wallet) {
  if (!wallet) return;
  try {
    localStorage.removeItem(storageKey(wallet));
  } catch (e) { /* ignore */ }
}

// True if a valid, unexpired session already exists for this wallet - WITHOUT
// prompting for a signature. Lets passive UI (e.g. the admin on-chain readout in
// the nav) fetch admin-only data only when the admin has already signed in,
// instead of triggering a MetaMask popup on every page load.
export function hasSession(wallet) {
  if (!wallet) return false;
  return readStored(wallet.toLowerCase()) !== null;
}

// Perform the nonce -> sign -> verify handshake and store the token.
async function doSignIn(wallet) {
  const address = wallet.toLowerCase();
  if (!window.ethereum) throw new Error("No wallet detected");

  // 1) Ask the server for a challenge.
  const nonceRes = await fetch(`${API_BASE}/api/auth/nonce?wallet=${address}`);
  if (!nonceRes.ok) throw new Error("Could not start sign-in");
  const { nonce, message } = await nonceRes.json();

  // 2) Sign it with the wallet (the one signature prompt per session).
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const signature = await signer.signMessage(message);

  // 3) Exchange the signature for a session token.
  const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: address, nonce, signature })
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    throw new Error(err.error || "Sign-in failed");
  }
  const data = await verifyRes.json();
  try {
    localStorage.setItem(storageKey(address), JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
  } catch (e) { /* storage may be unavailable; token still returned */ }
  return data.token;
}

// Return a valid token for the wallet, signing in if necessary. Concurrent
// callers share one prompt.
export async function ensureSession(wallet) {
  if (!wallet) throw new Error("Wallet not connected");
  const address = wallet.toLowerCase();

  const stored = readStored(address);
  if (stored) return stored.token;

  if (!pendingSignIn[address]) {
    pendingSignIn[address] = doSignIn(address).finally(() => {
      delete pendingSignIn[address];
    });
  }
  return pendingSignIn[address];
}

// fetch() with the session bearer token attached. On a 401 it clears the session,
// signs in once more, and retries a single time.
export async function authorizedFetch(url, options = {}, wallet) {
  if (!wallet) throw new Error("Wallet not connected");

  const withToken = async (token) => {
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    return fetch(url, { ...options, headers });
  };

  let token = await ensureSession(wallet);
  let res = await withToken(token);

  if (res.status === 401) {
    // Token rejected (expired/rotated secret). Re-authenticate once and retry.
    clearSession(wallet);
    token = await ensureSession(wallet);
    res = await withToken(token);
  }

  return res;
}
