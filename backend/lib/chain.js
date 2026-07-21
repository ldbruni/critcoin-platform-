// Read-only Sepolia access for preflight checks and reconciliation.
//
// This module deliberately holds NO signer and NO private key. The backend never
// sends a transaction - the admin's MetaMask wallet signs every on-chain
// transfer in the browser. Everything here is an eth_call or eth_getBalance.
//
// Configure with SEPOLIA_RPC_URL (e.g. an Alchemy or Infura HTTPS endpoint).
// Every function degrades to null when the RPC is unreachable rather than
// throwing, so a dead RPC never takes down a whole response.

const { ethers } = require("ethers");
const contractInfo = require("../sepolia.json");

// The Token contract writes two storage slots and emits one event. Real
// transfers measure around 35-52k gas; this ceiling gives preflight headroom
// when estimateGas is unavailable.
const FALLBACK_TRANSFER_GAS = 65000;

// Ask for meaningfully more Sepolia ETH than the estimate suggests, so a deploy
// doesn't strand halfway through the roster on a gas price bump.
const GAS_SAFETY_MARGIN = 1.5;

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

// Sepolia ETH balance in wei, as a BigNumber. Returns null if unreachable.
async function getEthBalance(address) {
  const p = getProvider();
  if (!p) return null;
  try {
    return await p.getBalance(address);
  } catch (err) {
    console.warn(`⚠️ chain: getBalance(${address}) failed - ${err.message}`);
    return null;
  }
}

// Incoming CritCoin transfers from `fromAddress` to `toAddress`, read from the
// chain's Transfer event log. Both fields are indexed on the Token's
// Transfer(address indexed _from, address indexed _to, uint256 _value) event, so
// this is a cheap topic-filtered query - the result set is only the transfers
// between exactly these two wallets.
//
// This is the read half of admin-grant absorption (see lib/adminGrants.js). It
// filters on `from` at the chain level, which is the safety guarantee: a transfer
// from any wallet other than the deployer is never returned, so it can never be
// absorbed into the ledger.
//
// Returns [] (never throws) when the RPC is unreachable or the query fails, so a
// dead RPC degrades to "nothing to absorb" and the grant stays visible as drift
// in the reconcile report rather than taking down profile creation.
//
// TOKEN_DEPLOY_BLOCK narrows the scan to the contract's deployment block; without
// it the scan starts at 0, which some RPC providers reject for too-wide a range.
async function getIncomingTransfersFrom(fromAddress, toAddress, { fromBlock } = {}) {
  const c = getContract();
  if (!c || !fromAddress || !toAddress) return [];

  const start = fromBlock ?? (process.env.TOKEN_DEPLOY_BLOCK ? Number(process.env.TOKEN_DEPLOY_BLOCK) : 0);

  try {
    const filter = c.filters.Transfer(fromAddress, toAddress);
    const events = await c.queryFilter(filter, start, "latest");

    // Resolve block timestamps once per block, not once per event.
    const blockCache = new Map();
    const results = [];
    for (const ev of events) {
      let ts = blockCache.get(ev.blockNumber);
      if (ts === undefined) {
        try {
          const block = await ev.getBlock();
          ts = block ? new Date(block.timestamp * 1000) : null;
        } catch (e) {
          ts = null;
        }
        blockCache.set(ev.blockNumber, ts);
      }
      results.push({
        txHash: ev.transactionHash.toLowerCase(),
        from: ev.args._from.toLowerCase(),
        to: ev.args._to.toLowerCase(),
        // The Token has no decimals - _value is a whole count of CritCoin.
        amount: Number(ev.args._value.toString()),
        blockNumber: ev.blockNumber,
        timestamp: ts
      });
    }
    return results;
  } catch (err) {
    console.warn(`⚠️ chain: getIncomingTransfersFrom(${fromAddress} -> ${toAddress}) failed - ${err.message}`);
    return [];
  }
}

// Estimated wei cost of a single transfer, for roster-wide gas preflight.
// Falls back to a fixed gas ceiling when estimateGas can't run (which it often
// can't - estimating a transfer the deployer cannot afford reverts).
async function estimateTransferCost({ from, to, amount }) {
  const p = getProvider();
  const c = getContract();
  if (!p || !c) return null;

  try {
    const gasPrice = await p.getGasPrice();

    let gasLimit = ethers.BigNumber.from(FALLBACK_TRANSFER_GAS);
    if (from && to) {
      try {
        gasLimit = await c.estimateGas.transfer(to, amount, { from });
      } catch (err) {
        // Expected when the deployer is short on CritCoin - the balance check
        // reports that far more clearly than a gas error would.
        console.warn(`⚠️ chain: estimateGas failed, using fallback - ${err.message}`);
      }
    }

    return gasPrice.mul(gasLimit);
  } catch (err) {
    console.warn(`⚠️ chain: gas estimation failed - ${err.message}`);
    return null;
  }
}

module.exports = {
  isConfigured,
  getCritBalance,
  getEthBalance,
  getIncomingTransfersFrom,
  estimateTransferCost,
  contractAddress: contractInfo.address,
  GAS_SAFETY_MARGIN
};
