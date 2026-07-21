// src/pages/Explorer.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AddressLink, TxLink } from "../components/ChainLink";

const API = {
  explorer: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/explorer` : "http://localhost:3001/api/explorer",
  profiles: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/profiles` : "http://localhost:3001/api/profiles"
};

export default function Explorer() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    wallet: "",
    type: "",
    from: "",
    to: ""
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    fetchTransactions();
  }, [filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 25
      });

      if (filters.wallet) params.append('wallet', filters.wallet);
      if (filters.type) params.append('type', filters.type);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);

      console.log("Fetching transactions from:", `${API.explorer}/transactions?${params}`);
      const res = await fetch(`${API.explorer}/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        console.log("Transaction data received:", data);
        setTransactions(data.transactions);
        setPagination(data.pagination);
      } else {
        console.error("Failed to fetch transactions, status:", res.status);
        const errorText = await res.text();
        console.error("Error response:", errorText);
      }
    } catch (err) {
      console.error("Network error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API.explorer}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchTransactionDetails = async (txId) => {
    try {
      const res = await fetch(`${API.explorer}/transaction/${txId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTransaction(data);
      }
    } catch (err) {
      console.error("Error fetching transaction details:", err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      wallet: "",
      type: "",
      from: "",
      to: ""
    });
  };

  const createSampleData = async () => {
    try {
      const res = await fetch(`${API.explorer}/sample-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        // Refresh the data
        fetchTransactions();
        fetchStats();
      } else {
        const error = await res.text();
        alert(`Error: ${error}`);
      }
    } catch (err) {
      console.error("Error creating sample data:", err);
      alert("Error creating sample data. Check console for details.");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeColor = (type) => {
    const colors = {
      'project_tip': 'var(--status-positive)',
      'transfer': 'var(--primary-blue)',
      'forum_reward': 'var(--status-warning)',
      'system': 'var(--text-muted)',
      'mint': 'var(--primary-blue-lighter)',
      'burn': 'var(--status-negative)'
    };
    return colors[type] || 'var(--text-muted)';
  };

  // Map a stored transaction `type` to its human-readable display label. Stored
  // values are never renamed — archived semesters and existing rows keep
  // `project_tip` (and legacy `tip`); the "investment" wording is applied only
  // here at render time. Kept specific ("Project investment") so it reads
  // distinctly from a prediction-market position.
  const getTypeLabel = (type) => {
    const labels = {
      'project_tip': 'Project investment',
      'tip': 'Project investment', // legacy stored value from archived semesters
      'transfer': 'Transfer',
      'forum_reward': 'Forum reward',
      'system': 'System',
      'mint': 'Mint',
      'burn': 'Burn',
      'adminGrant': 'Admin grant'
    };
    return labels[type] || type.replace(/_/g, ' ');
  };

  // The tip flow stores descriptions like "Tip for project: <title>". Rename only
  // the generated prefix at render time — the project title is left untouched so a
  // title that itself contains "tip" is never mangled, and stored data is unchanged.
  const formatDescription = (description) =>
    (description || '').replace(/^Tip for project:/, 'Investment in project:');

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div className="v2-masthead">
        <div className="v2-kicker">CritCoin · Explorer</div>
        <h1 className="gothic-title gothic-text">CritCoin Explorer</h1>
      </div>

      {/* Statistics Dashboard */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: "1rem", 
        marginBottom: "2rem" 
      }}>
        <div style={{ 
          backgroundColor: "var(--surface-muted)", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid var(--surface-card-border)" 
        }}>
          <h4>Total Transactions</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--primary-blue)" }}>
            {stats.totalTransactions?.toLocaleString() || 0}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: "var(--surface-muted)", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid var(--surface-card-border)" 
        }}>
          <h4>Total Volume</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--status-positive)" }}>
            {stats.totalVolume?.toLocaleString() || 0} CC
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: "var(--surface-muted)", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid var(--surface-card-border)" 
        }}>
          <h4>24h Transactions</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--status-warning)" }}>
            {stats.last24h?.transactions || 0}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: "var(--surface-muted)", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid var(--surface-card-border)" 
        }}>
          <h4>24h Volume</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--status-negative)" }}>
            {stats.last24h?.volume || 0} CC
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        backgroundColor: "var(--surface-muted)", 
        padding: "1rem", 
        borderRadius: "8px", 
        marginBottom: "2rem",
        border: "1px solid var(--surface-card-border)"
      }}>
        <h4>Filters</h4>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "1rem" 
        }}>
          <input
            type="text"
            name="wallet"
            placeholder="Wallet Address"
            value={filters.wallet}
            onChange={handleFilterChange}
            style={{ padding: "0.5rem", background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "2px" }}
          />
          
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            style={{ padding: "0.5rem", background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "2px" }}
          >
            <option value="">All Types</option>
            <option value="project_tip">Project Investments</option>
            <option value="transfer">Transfers</option>
            <option value="forum_reward">Forum Rewards</option>
            <option value="system">System</option>
            <option value="mint">Mint</option>
            <option value="burn">Burn</option>
          </select>
          
          <input
            type="date"
            name="from"
            value={filters.from}
            onChange={handleFilterChange}
            style={{ padding: "0.5rem", background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "2px" }}
          />
          
          <input
            type="date"
            name="to"
            value={filters.to}
            onChange={handleFilterChange}
            style={{ padding: "0.5rem", background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "2px" }}
          />
        </div>
        
        <button 
          onClick={clearFilters}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "var(--text-muted)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* Transaction List */}
      <div style={{ backgroundColor: "var(--surface-card)", borderRadius: "8px", border: "1px solid var(--surface-card-border)" }}>
        <div style={{ 
          padding: "1rem", 
          borderBottom: "1px solid var(--surface-card-border)",
          backgroundColor: "var(--surface-muted)",
          fontWeight: "bold"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 120px 80px", gap: "1rem" }}>
            <span>Type</span>
            <span>From</span>
            <span>To</span>
            <span>Amount</span>
            <span>Time</span>
            <span>Details</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h3>No transactions found</h3>
              <p>The explorer will show data when:</p>
              <ul style={{ textAlign: "left", display: "inline-block" }}>
                <li>Students invest in projects</li>
                <li>Admin deploys CritCoin</li>
                <li>Users transfer CritCoin to each other</li>
                <li>Forum rewards are distributed</li>
              </ul>
            </div>
            <button
              onClick={createSampleData}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--primary-blue)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "1rem"
              }}
            >
              Create Sample Data (Development)
            </button>
          </div>
        ) : (
          transactions.map((tx, index) => (
            <div 
              key={tx._id}
              style={{ 
                padding: "1rem", 
                borderBottom: index < transactions.length - 1 ? "1px solid var(--surface-card-border)" : "none",
                backgroundColor: index % 2 === 0 ? "var(--surface-card)" : "var(--surface-muted)"
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 120px 80px", gap: "1rem", alignItems: "center" }}>
                <span style={{ 
                  color: getTypeColor(tx.type),
                  fontWeight: "bold"
                }}>
                  {getTypeLabel(tx.type)}
                </span>
                
                <div style={{ display: "flex", alignItems: "center" }}>
                  {tx.fromPhoto && (
                    <img
                      src={`${API.profiles}/photo/${tx.fromPhoto}`}
                      alt="Profile"
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        marginRight: "0.5rem"
                      }}
                    />
                  )}
                  <AddressLink
                    address={tx.fromWallet}
                    label={tx.fromName && tx.fromName !== tx.fromWallet ? tx.fromName : formatAddress(tx.fromWallet)}
                  />
                </div>
                
                <div style={{ display: "flex", alignItems: "center" }}>
                  {tx.toPhoto && (
                    <img
                      src={`${API.profiles}/photo/${tx.toPhoto}`}
                      alt="Profile"
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        marginRight: "0.5rem"
                      }}
                    />
                  )}
                  <AddressLink
                    address={tx.toWallet}
                    label={tx.toName && tx.toName !== tx.toWallet ? tx.toName : formatAddress(tx.toWallet)}
                  />
                </div>
                
                <span style={{ fontWeight: "bold", color: "var(--status-positive)" }}>
                  {tx.amount} CC
                </span>
                
                <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  {formatDate(tx.timestamp)}
                </span>
                
                <button
                  onClick={() => fetchTransactionDetails(tx._id)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    backgroundColor: "var(--primary-blue)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem"
                  }}
                >
                  View
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 1 && (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          gap: "1rem", 
          marginTop: "2rem" 
        }}>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={!pagination.hasPrev}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: pagination.hasPrev ? "var(--primary-blue)" : "var(--text-muted)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: pagination.hasPrev ? "pointer" : "not-allowed"
            }}
          >
            Previous
          </button>
          
          <span>Page {pagination.current} of {pagination.total}</span>
          
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!pagination.hasNext}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: pagination.hasNext ? "var(--primary-blue)" : "var(--text-muted)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: pagination.hasNext ? "pointer" : "not-allowed"
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "var(--surface-card)",
            padding: "2rem",
            borderRadius: "8px",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto"
          }}>
            <h3>Transaction Details</h3>
            <div style={{ marginBottom: "1rem" }}>
              <strong>Transaction ID:</strong><br />
              <code style={{ fontSize: "0.9rem", backgroundColor: "var(--surface-muted)", padding: "0.25rem" }}>
                {selectedTransaction._id}
              </code>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Transaction Hash:</strong><br />
              <span style={{ fontSize: "0.9rem" }}>
                <TxLink
                  hash={selectedTransaction.txHash}
                  fabricated={selectedTransaction.hashFabricated}
                  short={false}
                />
              </span>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Type:</strong> 
              <span style={{ 
                color: getTypeColor(selectedTransaction.type),
                marginLeft: "0.5rem",
                fontWeight: "bold"
              }}>
                {getTypeLabel(selectedTransaction.type)}
              </span>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>From:</strong> {selectedTransaction.fromName}<br />
              <span style={{ fontSize: "0.8rem" }}>
                <AddressLink address={selectedTransaction.fromWallet} short={false} />
              </span>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <strong>To:</strong> {selectedTransaction.toName}<br />
              <span style={{ fontSize: "0.8rem" }}>
                <AddressLink address={selectedTransaction.toWallet} short={false} />
              </span>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Amount:</strong> 
              <span style={{ fontSize: "1.2rem", color: "var(--status-positive)", marginLeft: "0.5rem" }}>
                {selectedTransaction.amount} CritCoin
              </span>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Timestamp:</strong> {formatDate(selectedTransaction.timestamp)}
            </div>
            
            {selectedTransaction.description && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Description:</strong> {formatDescription(selectedTransaction.description)}
              </div>
            )}
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Status:</strong> 
              <span style={{ 
                color: selectedTransaction.status === 'completed' ? 'var(--status-positive)' : 'var(--status-warning)',
                marginLeft: "0.5rem",
                fontWeight: "bold"
              }}>
                {selectedTransaction.status}
              </span>
            </div>
            
            <button
              onClick={() => setSelectedTransaction(null)}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--text-muted)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}