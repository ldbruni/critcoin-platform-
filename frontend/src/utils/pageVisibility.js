// Page visibility: which toggleable pages (Prediction, The Feed) students can
// see. The page list lives on the server (backend/lib/pageVisibility.js);
// this module reads it and tags API requests with the viewer's wallet so a
// hidden page still works for the admin.

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

// A page missing from the response is visible: every toggle defaults to on.
export const isPageVisible = (visibility, page) => visibility?.[page] !== false;

export async function fetchPageVisibility() {
  const res = await fetch(`${API_BASE}/api/admin/public/page-visibility`);
  if (!res.ok) throw new Error("Failed to fetch page visibility");
  return res.json(); // { pages: { id: label }, visibility: { id: boolean } }
}

// The connected wallet, set by App. Sent as X-Wallet on a gated page's API
// calls; the server lets the admin through while the page is hidden.
let viewerWallet = null;

export function setViewerWallet(wallet) {
  viewerWallet = wallet ? wallet.toLowerCase() : null;
}

export function viewerHeaders(headers = {}) {
  return viewerWallet ? { ...headers, "X-Wallet": viewerWallet } : headers;
}
