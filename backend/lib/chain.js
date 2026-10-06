// Read-only Sepolia access for the reconciliation diagnostic.
//
// This module deliberately holds NO signer and NO private key. The backend never
// sends a transaction - the admin's MetaMask wallet signs every on-chain
// transfer in the browser, including the CritCoin deploy. Everything here is an
// eth_call.
//
// Configure with SEPOLIA_RPC_URL (e.g. an Alchemy or Infura HTTPS endpoint).
// Every function degrades to null when the RPC is unreachable rather than
// throwing, so a dead RPC never takes down a whole response.

const { ethers } = require("ethers");
const contractInfo = require("../sepolia.json");

let provider = null;
let contract = null;

// SEPOLIA_RPC_URL is the intended name. ALCHEMY_API_KEY is accepted as a
// fallback because it already holds a full Sepolia RPC URL in existing
// deployments - despite the name, it is not a bare key.
const rpcUrl = () => process.env.SEPOLIA_RPC_URL || process.env.ALCHEMY_API_KEY || null;

function getProvider() {
  const url = rpcUrl();
  if (!url) return null;
  if (!provider) {
    provider = new ethers.providers.JsonRpcProvider(url);
  }
  return provider;
}

function getContract() {
  const p = getProvider();
  if (!p) return null;
  if (!contract) {
    contract = new ethers.Contract(contractInfo.address, contractInfo.abi, p);
  }
  return contract;
}

const isConfigured = () => Boolean(rpcUrl());

// CritCoin balance as a plain integer. The Token has no decimals - amounts are
// whole units. Returns null if the RPC is unreachable.
async function getCritBalance(address) {
  const c = getContract();
  if (!c) return null;
  try {
    const balance = await c.balanceOf(address);
    return Number(balance.toString());
  } catch (err) {
    console.warn(`⚠️ chain: balanceOf(${address}) failed - ${err.message}`);
    return null;
  }
}

module.exports = {
  isConfigured,
  getCritBalance,
  contractAddress: contractInfo.address
};
