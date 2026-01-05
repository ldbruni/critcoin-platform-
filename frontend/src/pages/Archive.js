// src/pages/Archive.js
// Semester Archive Viewer - matches live site styling
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/archive`
  : "http://localhost:3001/api/archive";

export default function Archive() {
  const { archiveId } = useParams();
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState(1);
  const [showComments, setShowComments] = useState({});

  useEffect(() => {
    fetchArchives();
  }, []);

  useEffect(() => {
    if (archiveId) {
      fetchArchiveDetails(archiveId);
    } else {
      setSelectedArchive(null);
      setActiveSection("overview");
    }
  }, [archiveId]);

  const fetchArchives = async () => {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setArchives(data);
      }
    } catch (err) {
      console.error("Failed to fetch archives:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchiveDetails = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedArchive(data);
      }
    } catch (err) {
      console.error("Failed to fetch archive details:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const toggleComments = (postIndex) => {
    setShowComments(prev => ({ ...prev, [postIndex]: !prev[postIndex] }));
  };

  const copyWalletAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      alert('Wallet address copied to clipboard!');
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Wallet address copied to clipboard!');
    }
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

  // Archive List View
  if (!archiveId) {
    return (
      <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <h1 className="gothic-title gothic-text">Semester Archives</h1>
        <p className="sage-text" style={{ fontFamily: "Crimson Text, serif", marginBottom: "2rem", textAlign: "center" }}>
          Browse past semesters and view historical data from previous classes.
        </p>

        {loading ? (
          <p style={{ textAlign: "center" }}>Loading archives...</p>
        ) : archives.length === 0 ? (
          <div className="artistic-card" style={{
            textAlign: "center",
            padding: "3rem",
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(22, 163, 74, 0.03))',
            border: '2px solid var(--complement-blue)'
          }}>
            <h3 className="copper-text">No Archives Yet</h3>
            <p style={{ color: "rgba(255,255,255,0.6)", fontFamily: 'Crimson Text, serif' }}>
              Past semesters will appear here once archived by the admin.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.5rem"
          }}>
            {archives.map((archive) => (
              <Link
                key={archive._id}
                to={`/archive/${archive._id}`}
                style={{ textDecoration: "none" }}
              >
                <div className="artistic-card" style={{
                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(220, 38, 38, 0.05))",
                  border: "2px solid var(--accent-gold)",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  height: "100%"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(245, 158, 11, 0.3)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                >
                  <h3 className="gothic-text" style={{ marginBottom: "0.5rem", fontFamily: 'Cinzel, serif' }}>
                    {archive.name}
                  </h3>
                  {archive.description && (
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", marginBottom: "1rem", fontFamily: 'Crimson Text, serif' }}>
                      {archive.description}
                    </p>
                  )}
                  <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>
                    Archived: {formatDate(archive.archivedAt)}
                  </div>
                  {archive.stats && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "0.5rem",
                      fontSize: "0.85rem",
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                      paddingTop: "1rem"
                    }}>
                      <div className="sage-text">{archive.stats.totalProfiles} Profiles</div>
                      <div className="copper-text">{archive.stats.totalProjects} Projects</div>
                      <div className="ember-text">{archive.stats.totalPosts} Posts</div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Archive Detail View
  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <Link to="/archive" className="artistic-btn" style={{
          display: "inline-block",
          marginBottom: "1rem",
          background: 'rgba(37, 99, 235, 0.1)',
          border: '1px solid var(--accent-blue)',
          color: 'var(--accent-blue)',
          padding: '0.5rem 1rem',
          textDecoration: 'none'
        }}>
          &larr; Back to Archives
        </Link>
        {selectedArchive && (
          <>
            <h1 className="gothic-title gothic-text">
              {selectedArchive.name}
            </h1>
            {selectedArchive.description && (
              <p className="sage-text" style={{ fontFamily: "Crimson Text, serif", fontSize: "1.1rem" }}>
                {selectedArchive.description}
              </p>
            )}
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>
              Archived on {formatDate(selectedArchive.archivedAt)}
            </p>
          </>
        )}
      </div>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "2rem", borderBottom: "2px solid var(--dark-elevated)", paddingBottom: "1rem" }}>
        {["overview", "profiles", "projects", "leaderboard", "forum", "explorer"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className="artistic-btn"
            style={{
              margin: "0 0.5rem 0.5rem 0",
              padding: "0.5rem 1rem",
              background: activeSection === tab ? "var(--gradient-accent)" : "rgba(255,255,255,0.05)",
              border: activeSection === tab ? "none" : "1px solid var(--dark-elevated)",
              color: "white",
              textTransform: "capitalize",
              fontWeight: activeSection === tab ? "bold" : "normal",
              fontFamily: 'Cinzel, serif'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : selectedArchive && (
        <>
          {/* Overview Section */}
          {activeSection === "overview" && (
            <div>
              <h2 className="copper-text" style={{ fontFamily: 'Cinzel, serif', marginBottom: '1.5rem' }}>Statistics</h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "1rem",
                marginBottom: "2rem"
              }}>
                {[
                  { label: "Profiles", value: selectedArchive.stats?.totalProfiles, color: "var(--complement-green)" },
                  { label: "Projects", value: selectedArchive.stats?.totalProjects, color: "var(--accent-gold)" },
                  { label: "Posts", value: selectedArchive.stats?.totalPosts, color: "var(--accent-copper)" },
                  { label: "Comments", value: selectedArchive.stats?.totalComments, color: "var(--accent-blue)" },
                  { label: "Transactions", value: selectedArchive.stats?.totalTransactions, color: "var(--complement-blue)" },
                  { label: "CritCoin Transferred", value: selectedArchive.stats?.totalCritCoinTransferred?.toLocaleString(), color: "var(--primary-red)" }
                ].map((stat, i) => (
                  <div key={i} className="artistic-card" style={{
                    textAlign: "center",
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--dark-elevated)'
                  }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: stat.color, fontFamily: 'Cinzel, serif' }}>
                      {stat.value || 0}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", fontFamily: 'Crimson Text, serif' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Leaderboard Preview */}
              {selectedArchive.leaderboard && selectedArchive.leaderboard.length > 0 && (
                <div>
                  <h2 className="copper-text" style={{ fontFamily: 'Cinzel, serif', marginBottom: '1.5rem' }}>Leaderboard Highlights</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                    {selectedArchive.leaderboard.map((project) => (
                      <div key={project.projectNumber} className="artistic-card" style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--dark-elevated)'
                      }}>
                        <h4 className="sage-text" style={{ fontFamily: 'Cinzel, serif', marginBottom: '1rem' }}>
                          Project {project.projectNumber}
                        </h4>
                        {project.entries.length > 0 ? (
                          <ol style={{ margin: 0, paddingLeft: "1.5rem" }}>
                            {project.entries.map((entry) => (
                              <li key={entry.rank} style={{ marginBottom: "0.5rem", fontFamily: 'Crimson Text, serif' }}>
                                <span className="ember-text" style={{ fontWeight: 'bold' }}>{entry.authorName}</span>
                                <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "0.5rem" }}>
                                  ({entry.totalReceived} CC)
                                </span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic", fontFamily: 'Crimson Text, serif' }}>No entries</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profiles Section - matches Profiles.js styling */}
          {activeSection === "profiles" && selectedArchive.profiles && (
            <div>
              <h2 className="copper-text" style={{ fontFamily: 'Cinzel, serif', marginBottom: '1.5rem' }}>
                Community Profiles ({selectedArchive.profiles.length})
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1.5rem"
              }}>
                {selectedArchive.profiles.map((profile, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "1.5rem",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                  >
                    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                      {profile.photo ? (
                        <img
                          src={profile.photo}
                          alt={`${profile.name}'s profile`}
                          style={{
                            width: "80px",
                            height: "80px",
                            objectFit: "cover",
                            borderRadius: "50%",
                            border: "3px solid #007bff",
                            backgroundColor: "#f8f9fa"
                          }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "50%",
                          border: "3px solid #007bff",
                          backgroundColor: "#e9ecef",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2rem",
                          color: "#6c757d",
                          margin: "0 auto"
                        }}>
                          {profile.name?.charAt(0) || "P"}
                        </div>
                      )}
                    </div>
                    <h4 style={{ textAlign: "center", marginBottom: "0.5rem", color: "#333" }}>
                      {profile.name || 'Unknown User'}
                    </h4>
                    {profile.starSign && (
                      <p style={{ textAlign: "center", color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                        Star sign: {profile.starSign}
                      </p>
                    )}

                    {/* Wallet Address with Copy Button */}
                    <div style={{
                      textAlign: "center",
                      marginBottom: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "4px",
                      border: "1px solid #e9ecef"
                    }}>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                        Wallet Address
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <code style={{
                          fontSize: "0.7rem",
                          backgroundColor: "#ffffff",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "3px",
                          border: "1px solid #ddd",
                          color: "#333",
                          wordBreak: "break-all"
                        }}>
                          {profile.wallet?.slice(0, 10)}...{profile.wallet?.slice(-8)}
                        </code>
                        <button
                          onClick={() => copyWalletAddress(profile.wallet)}
                          style={{
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.7rem",
                            cursor: "pointer"
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div style={{
                      marginTop: "1rem",
                      padding: "0.5rem",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      color: "#666",
                      textAlign: "center"
                    }}>
                      Joined: {profile.createdAt ? formatDate(profile.createdAt) : 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section - matches Projects.js styling */}
          {activeSection === "projects" && selectedArchive.projects && (
            <div>
              <h2 className="copper-text" style={{ fontFamily: 'Cinzel, serif', marginBottom: '1.5rem' }}>Projects</h2>

              {/* Project Number Tabs */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ marginBottom: "0.5rem", color: "rgba(255,255,255,0.8)" }}>Select Project:</h3>
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setActiveProject(num)}
                    style={{
                      margin: "0 0.5rem 0.5rem 0",
                      padding: "0.5rem 1rem",
                      backgroundColor: activeProject === num ? "#007bff" : "#f8f9fa",
                      color: activeProject === num ? "white" : "black",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    Project {num}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {selectedArchive.projects
                  .filter(p => p.projectNumber === activeProject)
                  .map((project, i) => (
                  <div key={i} style={{
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "1rem",
                    backgroundColor: "#f9f9f9"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                      <strong style={{ color: "#333" }}>{project.authorName}</strong>
                    </div>

                    {project.image && (
                      <img
                        src={project.image}
                        alt={project.title}
                        style={{
                          width: "100%",
                          height: "auto",
                          maxHeight: "400px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          marginBottom: "1rem",
                          backgroundColor: "#f0f0f0"
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}

                    <h4 style={{ color: "#333", marginBottom: "0.5rem" }}>{project.title}</h4>
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>{project.description}</p>
                    <p style={{ fontWeight: "bold", color: "#28a745", marginTop: "0.5rem" }}>
                      Received: {project.totalReceived || 0} CritCoin
                    </p>
                  </div>
                ))}
              </div>

              {selectedArchive.projects.filter(p => p.projectNumber === activeProject).length === 0 && (
                <p style={{ textAlign: "center", color: "#999", fontStyle: "italic" }}>
                  No submissions for Project {activeProject}
                </p>
              )}
            </div>
          )}

          {/* Leaderboard Section - matches Leaderboard.js styling */}
          {activeSection === "leaderboard" && selectedArchive.leaderboard && (
            <div>
              <h1 className="gothic-title gothic-text" style={{ textAlign: "center", marginBottom: "1rem" }}>
                CritCoin Leaderboard
              </h1>
              <p style={{ textAlign: "center", marginBottom: "2rem", fontSize: "1.1rem", color: "#666" }}>
                Top 3 projects with the most CritCoin received in each category
              </p>

              {selectedArchive.leaderboard.map((projectGroup) => {
                if (!projectGroup.entries || projectGroup.entries.length === 0) {
                  return null;
                }

                const medals = ["🥇", "🥈", "🥉"];

                return (
                  <div key={projectGroup.projectNumber} style={{ marginBottom: "3rem" }}>
                    <h2 style={{
                      fontSize: "2rem",
                      marginBottom: "1.5rem",
                      paddingBottom: "0.5rem",
                      borderBottom: "3px solid #007bff",
                      color: "white"
                    }}>
                      Project {projectGroup.projectNumber}
                    </h2>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                      gap: "1.5rem"
                    }}>
                      {projectGroup.entries.map((entry, index) => {
                        // Find the full project data
                        const fullProject = selectedArchive.projects?.find(
                          p => p.projectNumber === projectGroup.projectNumber &&
                               p.authorWallet?.toLowerCase() === entry.authorWallet?.toLowerCase()
                        );

                        return (
                          <div key={index} style={{
                            border: "2px solid #ddd",
                            borderRadius: "8px",
                            padding: "1rem",
                            backgroundColor: index === 0 ? "#fff9e6" : index === 1 ? "#f5f5f5" : "#fafafa",
                            boxShadow: index === 0 ? "0 4px 6px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)"
                          }}>
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              marginBottom: "0.5rem",
                              fontSize: "1.5rem",
                              fontWeight: "bold",
                              color: "#333"
                            }}>
                              <span style={{ marginRight: "0.5rem" }}>{medals[index]}</span>
                              <span>#{index + 1}</span>
                            </div>

                            {fullProject?.image && (
                              <img
                                src={fullProject.image}
                                alt={entry.title}
                                style={{
                                  width: "100%",
                                  height: "auto",
                                  maxHeight: "400px",
                                  objectFit: "contain",
                                  borderRadius: "8px",
                                  marginBottom: "1rem",
                                  backgroundColor: "#f0f0f0"
                                }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            )}

                            <h3 style={{ margin: "0.5rem 0", fontSize: "1.2rem", color: "#333" }}>{entry.title}</h3>
                            <strong style={{ color: "#333" }}>{entry.authorName}</strong>
                            <p style={{
                              fontSize: "1.1rem",
                              color: "#007bff",
                              fontWeight: "bold",
                              margin: "0.5rem 0"
                            }}>
                              {entry.totalReceived} CritCoin
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {selectedArchive.leaderboard.every(pg => !pg.entries || pg.entries.length === 0) && (
                <p style={{ textAlign: "center", color: "#999", fontSize: "1.2rem" }}>
                  No projects were submitted this semester.
                </p>
              )}
            </div>
          )}

          {/* Forum Section - matches FormPage.js styling */}
          {activeSection === "forum" && selectedArchive.posts && (
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <h1 className="gothic-title gothic-text">CritCoin Forum</h1>

              <div style={{ height: '2px', background: 'var(--gradient-primary)', margin: '2rem 0', borderRadius: '1px' }}></div>
              <div className="artistic-card" style={{ background: 'rgba(26, 26, 26, 0.6)', padding: '1rem', marginBottom: '1rem' }}>
                <h2 className="sage-text" style={{ marginBottom: '0', textAlign: 'center', fontFamily: 'Cinzel, serif' }}>
                  Forum Posts ({selectedArchive.posts.length})
                </h2>
              </div>

              {selectedArchive.posts.map((post, postIndex) => (
                <div key={postIndex} className="artistic-card" style={{
                  marginBottom: "1.5rem",
                  background: 'rgba(42, 42, 42, 0.8)',
                  border: '1px solid var(--dark-border)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Glowing border */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--gradient-accent)'
                  }}></div>

                  <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                    <div style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      background: 'var(--gradient-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: "1rem",
                      fontSize: '1.5rem'
                    }}>P</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'Cinzel, serif',
                        color: 'var(--accent-gold)',
                        fontWeight: '600',
                        marginBottom: '0.25rem'
                      }}>
                        {post.authorName}
                      </div>
                      <div style={{
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.5)",
                        fontFamily: 'Crimson Text, serif',
                        fontStyle: 'italic'
                      }}>
                        {formatDateTime(post.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--dark-elevated)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    fontFamily: 'Space Mono, monospace',
                    lineHeight: '1.6'
                  }}>
                    {post.content}
                  </div>

                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '6px',
                    border: '1px solid var(--dark-elevated)'
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(22, 163, 74, 0.1)',
                      border: '1px solid var(--complement-green)',
                      borderRadius: '20px'
                    }}>
                      ↑
                      <span style={{
                        color: "var(--complement-green)",
                        fontWeight: "bold",
                        fontFamily: 'Cinzel, serif',
                        marginLeft: '0.5rem'
                      }}>{post.upvotes || 0}</span>
                    </div>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(220, 38, 38, 0.1)',
                      border: '1px solid var(--primary-red)',
                      borderRadius: '20px'
                    }}>
                      ↓
                      <span style={{
                        color: "var(--primary-red)",
                        fontWeight: "bold",
                        fontFamily: 'Cinzel, serif',
                        marginLeft: '0.5rem'
                      }}>{post.downvotes || 0}</span>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {post.comments && post.comments.length > 0 && (
                    <div style={{
                      marginTop: '1rem',
                      borderTop: '1px solid var(--dark-elevated)',
                      paddingTop: '1rem'
                    }}>
                      <button
                        onClick={() => toggleComments(postIndex)}
                        className="artistic-btn"
                        style={{
                          background: 'rgba(37, 99, 235, 0.1)',
                          border: '1px solid var(--accent-blue)',
                          color: 'var(--accent-blue)',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          width: '100%'
                        }}
                      >
                        {showComments[postIndex] ? '▼' : '▶'} Comments ({post.comments.length})
                      </button>

                      {showComments[postIndex] && (
                        <div style={{ marginTop: '1rem' }}>
                          {post.comments.map((comment, ci) => (
                            <div key={ci} style={{
                              background: 'rgba(0, 0, 0, 0.2)',
                              border: '1px solid var(--dark-elevated)',
                              borderRadius: '8px',
                              padding: '1rem',
                              marginBottom: '0.5rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <div style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '50%',
                                  background: 'var(--gradient-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: '0.5rem',
                                  fontSize: '0.8rem'
                                }}>C</div>
                                <div>
                                  <div style={{
                                    fontFamily: 'Cinzel, serif',
                                    color: 'var(--accent-gold)',
                                    fontSize: '0.9rem',
                                    fontWeight: '600'
                                  }}>
                                    {comment.authorName}
                                  </div>
                                  <div style={{
                                    fontSize: '0.7rem',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontFamily: 'Crimson Text, serif'
                                  }}>
                                    {formatDateTime(comment.createdAt)}
                                  </div>
                                </div>
                              </div>
                              <div style={{
                                fontFamily: 'Space Mono, monospace',
                                fontSize: '0.85rem',
                                lineHeight: '1.6',
                                marginBottom: '0.5rem',
                                color: 'rgba(255,255,255,0.9)'
                              }}>
                                {comment.text}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{
                                  background: 'rgba(22, 163, 74, 0.1)',
                                  border: '1px solid var(--complement-green)',
                                  color: 'var(--complement-green)',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem'
                                }}>
                                  ↑ {comment.upvotes || 0}
                                </span>
                                <span style={{
                                  background: 'rgba(220, 38, 38, 0.1)',
                                  border: '1px solid var(--primary-red)',
                                  color: 'var(--primary-red)',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem'
                                }}>
                                  ↓ {comment.downvotes || 0}
                                </span>
                              </div>

                              {/* Replies */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div style={{ marginLeft: '2rem', marginTop: '0.5rem' }}>
                                  {comment.replies.map((reply, ri) => (
                                    <div key={ri} style={{
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      border: '1px solid var(--dark-elevated)',
                                      borderLeft: '3px solid var(--accent-blue)',
                                      borderRadius: '4px',
                                      padding: '0.75rem',
                                      marginBottom: '0.5rem'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div style={{
                                          width: '25px',
                                          height: '25px',
                                          borderRadius: '50%',
                                          background: 'var(--gradient-secondary)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          marginRight: '0.5rem',
                                          fontSize: '0.7rem'
                                        }}>R</div>
                                        <div>
                                          <div style={{
                                            fontFamily: 'Cinzel, serif',
                                            color: 'var(--accent-gold)',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                          }}>
                                            {reply.authorName}
                                          </div>
                                          <div style={{
                                            fontSize: '0.65rem',
                                            color: 'rgba(255,255,255,0.5)',
                                            fontFamily: 'Crimson Text, serif'
                                          }}>
                                            {formatDateTime(reply.createdAt)}
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{
                                        fontFamily: 'Space Mono, monospace',
                                        fontSize: '0.8rem',
                                        lineHeight: '1.6',
                                        color: 'rgba(255,255,255,0.85)'
                                      }}>
                                        {reply.text}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {selectedArchive.posts.length === 0 && (
                <p style={{ textAlign: "center", color: "#999", fontStyle: "italic" }}>
                  No forum posts this semester.
                </p>
              )}
            </div>
          )}

          {/* Explorer Section - matches Explorer.js styling */}
          {activeSection === "explorer" && selectedArchive.transactions && (
            <div>
              <h1>🔍 CritCoin Explorer</h1>

              {/* Statistics */}
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
                  <h4 style={{ color: "#333", margin: "0 0 0.5rem 0" }}>Total Transactions</h4>
                  <p style={{ fontSize: "1.5rem", margin: 0, color: "#007bff" }}>
                    {selectedArchive.stats?.totalTransactions?.toLocaleString() || 0}
                  </p>
                </div>

                <div style={{
                  backgroundColor: "#f8f9fa",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid #dee2e6"
                }}>
                  <h4 style={{ color: "#333", margin: "0 0 0.5rem 0" }}>Total Volume</h4>
                  <p style={{ fontSize: "1.5rem", margin: 0, color: "#28a745" }}>
                    {selectedArchive.stats?.totalCritCoinTransferred?.toLocaleString() || 0} CC
                  </p>
                </div>
              </div>

              {/* Transaction List */}
              <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #dee2e6" }}>
                <div style={{
                  padding: "1rem",
                  borderBottom: "1px solid #dee2e6",
                  backgroundColor: "#f8f9fa",
                  fontWeight: "bold"
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 150px", gap: "1rem" }}>
                    <span>Type</span>
                    <span>From</span>
                    <span>To</span>
                    <span>Amount</span>
                    <span>Time</span>
                  </div>
                </div>

                {selectedArchive.transactions.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                    No transactions recorded this semester.
                  </div>
                ) : (
                  selectedArchive.transactions.slice(0, 100).map((tx, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "1rem",
                        borderBottom: index < Math.min(selectedArchive.transactions.length, 100) - 1 ? "1px solid #e9ecef" : "none",
                        backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8f9fa"
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 150px", gap: "1rem", alignItems: "center" }}>
                        <span style={{
                          color: getTypeColor(tx.type),
                          fontWeight: "bold",
                          fontSize: "0.85rem"
                        }}>
                          {getTypeIcon(tx.type)} {tx.type?.replace('_', ' ') || 'transfer'}
                        </span>

                        <span style={{ color: "#333" }} title={tx.fromWallet}>
                          {tx.fromName || tx.fromWallet?.slice(0, 8) + '...'}
                        </span>

                        <span style={{ color: "#333" }} title={tx.toWallet}>
                          {tx.toName || tx.toWallet?.slice(0, 8) + '...'}
                        </span>

                        <span style={{ fontWeight: "bold", color: "#28a745" }}>
                          {tx.amount} CC
                        </span>

                        <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                          {formatDateTime(tx.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                {selectedArchive.transactions.length > 100 && (
                  <div style={{ padding: "1rem", textAlign: "center", color: "#666", borderTop: "1px solid #e9ecef" }}>
                    Showing first 100 of {selectedArchive.transactions.length} transactions
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
