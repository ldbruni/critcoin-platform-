// The single way the app reads a CritCoin balance.
//
// Balances come from the database ledger, never from the chain. Students verify
// on-chain state on Sepolia Etherscan via the links in components/ChainLink.js.
// See ARCHITECTURE.md, "Balance authority".
//
// Do not reintroduce contract.balanceOf() here or in any page.

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

export async function fetchBalance(wallet) {
  if (!wallet) return 0;

  try {
    const res = await fetch(`${API_BASE}/api/explorer/balance/${wallet}`);
    if (!res.ok) {
      console.error("Balance fetch failed:", res.status);
      return 0;
    }
    const data = await res.json();
    return Number(data.balance) || 0;
  } catch (err) {
    console.error("Balance fetch error:", err);
    return 0;
  }
}
