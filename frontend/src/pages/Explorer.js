// src/pages/Explorer.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

      const res = await fetch(`${API.explorer}/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setPagination(data.pagination);
      } else {
        console.error("Failed to fetch transactions");
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeColor = (type) => {
    const colors = {
      'project_tip': '#28a745',
      'transfer': '#007bff',
      'forum_reward': '#ffc107',
      'system': '#6c757d',
      'mint': '#17a2b8',
      'burn': '#dc3545'
    };
    return colors[type] || '#6c757d';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'project_tip': '🎨',
      'transfer': '💸',
      'forum_reward': '💬',
      'system': '⚙️',
      'mint': '➕',
      'burn': '🔥'
    };
    return icons[type] || '📝';
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>🔍 CritCoin Explorer</h1>
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: "0.5rem", 
        marginBottom: "1rem",
        fontSize: "1rem"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.5rem",
          width: "100%",
          justifyContent: "center"
        }}>
          <Link to="/profiles" style={{ textDecoration: "none" }}>👤 Profiles</Link>
          <span>|</span>
          <Link to="/projects" style={{ textDecoration: "none" }}>🎨 Projects</Link>
        </div>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          width: "100%",
          justifyContent: "center"
        }}>
          <Link to="/forum" style={{ textDecoration: "none" }}>💬 Forum</Link>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: "1rem", 
        marginBottom: "2rem" 
      }}>
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid #dee2e6" 
        }}>
          <h4>Total Transactions</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, color: "#007bff" }}>
            {stats.totalTransactions?.toLocaleString() || 0}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid #dee2e6" 
        }}>
          <h4>Total Volume</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, color: "#28a745" }}>
            {stats.totalVolume?.toLocaleString() || 0} CC
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid #dee2e6" 
        }}>
          <h4>24h Transactions</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, color: "#ffc107" }}>
            {stats.last24h?.transactions || 0}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "1rem", 
          borderRadius: "8px", 
          border: "1px solid #dee2e6" 
        }}>
          <h4>24h Volume</h4>
          <p style={{ fontSize: "1.5rem", margin: 0, color: "#dc3545" }}>
            {stats.last24h?.volume || 0} CC
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        backgroundColor: "#f8f9fa", 
        padding: "1rem", 
        borderRadius: "8px", 
        marginBottom: "2rem",
        border: "1px solid #dee2e6"
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
            style={{ padding: "0.5rem" }}
          />
          
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            style={{ padding: "0.5rem" }}
          >
            <option value="">All Types</option>
            <option value="project_tip">Project Tips</option>
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
            style={{ padding: "0.5rem" }}
          />
          
          <input
            type="date"
            name="to"
            value={filters.to}
            onChange={handleFilterChange}
            style={{ padding: "0.5rem" }}
          />
        </div>
        
        <button 
          onClick={clearFilters}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "#6c757d",
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
      <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #dee2e6" }}>
        <div style={{ 
          padding: "1rem", 
          borderBottom: "1px solid #dee2e6",
          backgroundColor: "#f8f9fa",
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
          <div style={{ padding: "2rem", textAlign: "center" }}>No transactions found</div>
        ) : (
          transactions.map((tx, index) => (
            <div 
              key={tx._id}
              style={{ 
                padding: "1rem", 
                borderBottom: index < transactions.length - 1 ? "1px solid #e9ecef" : "none",
                backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8f9fa"
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 120px 80px", gap: "1rem", alignItems: "center" }}>
                <span style={{ 
                  color: getTypeColor(tx.type),
                  fontWeight: "bold"
                }}>
                  {getTypeIcon(tx.type)} {tx.type.replace('_', ' ')}
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
                  <span title={tx.fromWallet}>
                    {tx.fromName && tx.fromName !== tx.fromWallet ? tx.fromName : formatAddress(tx.fromWallet)}
                  </span>
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
                  <span title={tx.toWallet}>
                    {tx.toName && tx.toName !== tx.toWallet ? tx.toName : formatAddress(tx.toWallet)}
                  </span>
                </div>
                
                <span style={{ fontWeight: "bold", color: "#28a745" }}>
                  {tx.amount} CC
                </span>
                
                <span style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                  {formatDate(tx.timestamp)}
                </span>
                
                <button
                  onClick={() => fetchTransactionDetails(tx._id)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    backgroundColor: "#007bff",
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
              backgroundColor: pagination.hasPrev ? "#007bff" : "#6c757d",
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
              backgroundColor: pagination.hasNext ? "#007bff" : "#6c757d",
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
            backgroundColor: "white",
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
              <code style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa", padding: "0.25rem" }}>
                {selectedTransaction._id}
              </code>
            </div>
            
            {selectedTransaction.txHash && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Transaction Hash:</strong><br />
                <code style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa", padding: "0.25rem" }}>
                  {selectedTransaction.txHash}
                </code>
              </div>
            )}
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Type:</strong> 
              <span style={{ 
                color: getTypeColor(selectedTransaction.type),
                marginLeft: "0.5rem",
                fontWeight: "bold"
              }}>
                {getTypeIcon(selectedTransaction.type)} {selectedTransaction.type.replace('_', ' ')}
              </span>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>From:</strong> {selectedTransaction.fromName}<br />
              <code style={{ fontSize: "0.8rem" }}>{selectedTransaction.fromWallet}</code>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>To:</strong> {selectedTransaction.toName}<br />
              <code style={{ fontSize: "0.8rem" }}>{selectedTransaction.toWallet}</code>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Amount:</strong> 
              <span style={{ fontSize: "1.2rem", color: "#28a745", marginLeft: "0.5rem" }}>
                {selectedTransaction.amount} CritCoin
              </span>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Timestamp:</strong> {formatDate(selectedTransaction.timestamp)}
            </div>
            
            {selectedTransaction.description && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Description:</strong> {selectedTransaction.description}
              </div>
            )}
            
            <div style={{ marginBottom: "1rem" }}>
              <strong>Status:</strong> 
              <span style={{ 
                color: selectedTransaction.status === 'completed' ? '#28a745' : '#ffc107',
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
                backgroundColor: "#6c757d",
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