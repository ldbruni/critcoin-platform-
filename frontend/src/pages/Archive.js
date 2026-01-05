// src/pages/Archive.js
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/archive`
  : "http://localhost:3001/api/archive";

const PROFILES_API = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/profiles`
  : "http://localhost:3001/api/profiles";

export default function Archive() {
  const { archiveId, section } = useParams();
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [activeSection, setActiveSection] = useState(section || "overview");
  const [sectionData, setSectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState(1);

  useEffect(() => {
    fetchArchives();
  }, []);

  useEffect(() => {
    if (archiveId) {
      fetchArchiveDetails(archiveId);
    } else {
      setSelectedArchive(null);
      setSectionData(null);
    }
  }, [archiveId]);

  useEffect(() => {
    if (archiveId && activeSection && activeSection !== "overview") {
      fetchSectionData(archiveId, activeSection);
    }
  }, [archiveId, activeSection]);

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

  const fetchSectionData = async (id, sectionName) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${id}/${sectionName}`);
      if (res.ok) {
        const data = await res.json();
        setSectionData(data);
      }
    } catch (err) {
      console.error("Failed to fetch section data:", err);
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

  // Archive List View
  if (!archiveId) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div className="artistic-card">
          <h1 className="gothic-title gothic-text">Semester Archives</h1>
          <p className="sage-text" style={{ fontFamily: "Crimson Text, serif", marginBottom: "2rem" }}>
            Browse past semesters and view historical data from previous classes.
          </p>

          {loading ? (
            <p>Loading archives...</p>
          ) : archives.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "8px",
              border: "1px dashed rgba(255,255,255,0.2)"
            }}>
              <h3 className="copper-text">No Archives Yet</h3>
              <p style={{ color: "rgba(255,255,255,0.6)" }}>
                Past semesters will appear here once archived by the admin.
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.5rem"
            }}>
              {archives.map((archive) => (
                <Link
                  key={archive._id}
                  to={`/archive/${archive._id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(220, 38, 38, 0.05))",
                    border: "2px solid var(--accent-gold)",
                    borderRadius: "8px",
                    padding: "1.5rem",
                    cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s"
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
                    <h3 className="gothic-text" style={{ marginBottom: "0.5rem" }}>
                      {archive.name}
                    </h3>
                    {archive.description && (
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                        {archive.description}
                      </p>
                    )}
                    <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>
                      Archived: {formatDate(archive.archivedAt)}
                    </div>
                    {archive.stats && (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "0.5rem",
                        marginTop: "1rem",
                        fontSize: "0.8rem"
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
      </div>
    );
  }

  // Archive Detail View
  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div className="artistic-card">
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <Link to="/archive" style={{ color: "var(--accent-gold)", textDecoration: "none", fontSize: "0.9rem" }}>
            &larr; Back to Archives
          </Link>
          {selectedArchive && (
            <>
              <h1 className="gothic-title gothic-text" style={{ marginTop: "1rem" }}>
                {selectedArchive.name}
              </h1>
              {selectedArchive.description && (
                <p className="sage-text" style={{ fontFamily: "Crimson Text, serif" }}>
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
        <div style={{ marginBottom: "2rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem" }}>
          {["overview", "profiles", "projects", "leaderboard", "forum", "explorer"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              style={{
                margin: "0 0.5rem 0.5rem 0",
                padding: "0.5rem 1rem",
                backgroundColor: activeSection === tab ? "var(--accent-gold)" : "rgba(255,255,255,0.1)",
                color: activeSection === tab ? "#1a1a2e" : "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                textTransform: "capitalize",
                fontWeight: activeSection === tab ? "bold" : "normal"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {/* Overview Section */}
            {activeSection === "overview" && selectedArchive && (
              <div>
                <h2 className="copper-text">Statistics</h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "1rem",
                  marginBottom: "2rem"
                }}>
                  {[
                    { label: "Profiles", value: selectedArchive.stats?.totalProfiles },
                    { label: "Projects", value: selectedArchive.stats?.totalProjects },
                    { label: "Posts", value: selectedArchive.stats?.totalPosts },
                    { label: "Comments", value: selectedArchive.stats?.totalComments },
                    { label: "Transactions", value: selectedArchive.stats?.totalTransactions },
                    { label: "CritCoin Transferred", value: selectedArchive.stats?.totalCritCoinTransferred?.toLocaleString() }
                  ].map((stat, i) => (
                    <div key={i} style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      padding: "1rem",
                      borderRadius: "8px",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: "bold" }} className="gothic-text">
                        {stat.value || 0}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Leaderboard Preview */}
                {selectedArchive.leaderboard && selectedArchive.leaderboard.length > 0 && (
                  <div>
                    <h2 className="copper-text">Leaderboard Highlights</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                      {selectedArchive.leaderboard.map((project) => (
                        <div key={project.projectNumber} style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          padding: "1rem",
                          borderRadius: "8px"
                        }}>
                          <h4 className="sage-text">Project {project.projectNumber}</h4>
                          {project.entries.length > 0 ? (
                            <ol style={{ margin: 0, paddingLeft: "1.5rem" }}>
                              {project.entries.map((entry) => (
                                <li key={entry.rank} style={{ marginBottom: "0.5rem" }}>
                                  <span className="ember-text">{entry.authorName}</span>
                                  <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "0.5rem" }}>
                                    ({entry.totalReceived} CC)
                                  </span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>No entries</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profiles Section */}
            {activeSection === "profiles" && sectionData && (
              <div>
                <h2 className="copper-text">Profiles ({sectionData.profiles?.length || 0})</h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "1rem"
                }}>
                  {sectionData.profiles?.map((profile, i) => (
                    <div key={i} style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      padding: "1rem",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem"
                    }}>
                      {profile.photo ? (
                        <img
                          src={profile.photo.startsWith('http') ? profile.photo : `${PROFILES_API}/photo/${profile.photo}`}
                          alt={profile.name}
                          style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{
                          width: "50px",
                          height: "50px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255,255,255,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          {profile.name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div>
                        <div className="ember-text" style={{ fontWeight: "bold" }}>{profile.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>{profile.starSign}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects Section */}
            {activeSection === "projects" && sectionData && (
              <div>
                <h2 className="copper-text">Projects</h2>
                {/* Project Number Tabs */}
                <div style={{ marginBottom: "1rem" }}>
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => setActiveProject(num)}
                      style={{
                        margin: "0 0.5rem 0.5rem 0",
                        padding: "0.5rem 1rem",
                        backgroundColor: activeProject === num ? "var(--ember)" : "rgba(255,255,255,0.1)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      Project {num}
                    </button>
                  ))}
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "1rem"
                }}>
                  {sectionData.projects?.filter(p => p.projectNumber === activeProject).map((project, i) => (
                    <div key={i} style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                      overflow: "hidden"
                    }}>
                      {project.image && (
                        <img
                          src={project.image.startsWith('http') ? project.image : `${PROFILES_API.replace('/profiles', '/projects')}/image/${project.image}`}
                          alt={project.title}
                          style={{ width: "100%", height: "150px", objectFit: "cover" }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div style={{ padding: "1rem" }}>
                        <h4 className="ember-text" style={{ margin: "0 0 0.5rem 0" }}>{project.title}</h4>
                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", margin: "0 0 0.5rem 0" }}>
                          by {project.authorName}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                          {project.description}
                        </p>
                        <div className="sage-text" style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                          {project.totalReceived || 0} CC received
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard Section */}
            {activeSection === "leaderboard" && sectionData && (
              <div>
                <h2 className="copper-text">Leaderboard</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                  {sectionData.leaderboard?.map((project) => (
                    <div key={project.projectNumber} style={{
                      background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(220, 38, 38, 0.05))",
                      border: "2px solid var(--accent-gold)",
                      borderRadius: "8px",
                      padding: "1.5rem"
                    }}>
                      <h3 className="gothic-text" style={{ marginBottom: "1rem" }}>Project {project.projectNumber}</h3>
                      {project.entries.length > 0 ? (
                        <div>
                          {project.entries.map((entry) => (
                            <div key={entry.rank} style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.75rem",
                              backgroundColor: entry.rank === 1 ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.05)",
                              borderRadius: "4px",
                              marginBottom: "0.5rem"
                            }}>
                              <div>
                                <span style={{
                                  fontSize: "1.2rem",
                                  fontWeight: "bold",
                                  marginRight: "0.75rem",
                                  color: entry.rank === 1 ? "var(--accent-gold)" : "rgba(255,255,255,0.6)"
                                }}>
                                  #{entry.rank}
                                </span>
                                <span className="ember-text">{entry.authorName}</span>
                              </div>
                              <div className="sage-text" style={{ fontWeight: "bold" }}>
                                {entry.totalReceived} CC
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic", textAlign: "center" }}>
                          No entries for this project
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forum Section */}
            {activeSection === "forum" && sectionData && (
              <div>
                <h2 className="copper-text">Forum Posts ({sectionData.posts?.length || 0})</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {sectionData.posts?.map((post, i) => (
                    <div key={i} style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                      padding: "1rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span className="ember-text" style={{ fontWeight: "bold" }}>{post.authorName}</span>
                        <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                          {formatDate(post.createdAt)}
                        </span>
                      </div>
                      <p style={{ margin: "0.5rem 0", lineHeight: "1.5" }}>{post.content}</p>
                      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                        <span className="sage-text">{post.upvotes} upvotes</span>
                        {" | "}
                        <span className="copper-text">{post.downvotes} downvotes</span>
                        {post.comments && post.comments.length > 0 && (
                          <span> | {post.comments.length} comments</span>
                        )}
                      </div>
                      {/* Comments */}
                      {post.comments && post.comments.length > 0 && (
                        <div style={{ marginTop: "1rem", paddingLeft: "1rem", borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
                          {post.comments.map((comment, ci) => (
                            <div key={ci} style={{ marginBottom: "0.75rem" }}>
                              <div style={{ fontSize: "0.85rem" }}>
                                <span className="sage-text">{comment.authorName}:</span>
                                <span style={{ marginLeft: "0.5rem" }}>{comment.text}</span>
                              </div>
                              {/* Replies */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
                                  {comment.replies.map((reply, ri) => (
                                    <div key={ri} style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.25rem" }}>
                                      <span className="copper-text">{reply.authorName}:</span>
                                      <span style={{ marginLeft: "0.5rem" }}>{reply.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explorer Section */}
            {activeSection === "explorer" && sectionData && (
              <div>
                <h2 className="copper-text">Transaction History ({sectionData.transactions?.length || 0})</h2>
                <div style={{
                  backgroundColor: "rgba(255,255,255,0.02)",
                  borderRadius: "8px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 100px 120px 150px",
                    gap: "1rem",
                    padding: "1rem",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    fontWeight: "bold",
                    fontSize: "0.85rem"
                  }}>
                    <div>From</div>
                    <div>To</div>
                    <div>Amount</div>
                    <div>Type</div>
                    <div>Date</div>
                  </div>
                  {sectionData.transactions?.slice(0, 50).map((tx, i) => (
                    <div key={i} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 100px 120px 150px",
                      gap: "1rem",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontSize: "0.85rem"
                    }}>
                      <div className="ember-text">{tx.fromName}</div>
                      <div className="sage-text">{tx.toName}</div>
                      <div style={{ fontWeight: "bold" }}>{tx.amount} CC</div>
                      <div style={{ color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>
                        {tx.type?.replace('_', ' ')}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.5)" }}>
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                  ))}
                  {sectionData.transactions?.length > 50 && (
                    <div style={{ padding: "1rem", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                      Showing first 50 of {sectionData.transactions.length} transactions
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
