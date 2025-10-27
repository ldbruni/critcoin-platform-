// src/pages/Leaderboard.js
// Build: 2025-10-27-04:45 - Fix empty state logic
import React, { useEffect, useState } from "react";

const API = {
  projects: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/projects` : "http://localhost:3001/api/projects"
};

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API.projects}/leaderboard/top`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      } else {
        console.error("Failed to fetch leaderboard");
      }
    } catch (err) {
      console.error("Network error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const ProjectCard = ({ project, rank }) => {
    const medals = ["🥇", "🥈", "🥉"];

    return (
      <div style={{
        border: "2px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        backgroundColor: rank === 0 ? "#fff9e6" : rank === 1 ? "#f5f5f5" : "#fafafa",
        boxShadow: rank === 0 ? "0 4px 6px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "0.5rem",
          fontSize: "1.5rem",
          fontWeight: "bold"
        }}>
          <span style={{ marginRight: "0.5rem" }}>{medals[rank]}</span>
          <span>#{rank + 1}</span>
        </div>

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
          onError={(e) => {
            console.error("Failed to load project image:", project.title);
            e.target.style.display = 'none';
          }}
        />

        <h3 style={{ margin: "0.5rem 0", fontSize: "1.2rem" }}>{project.title}</h3>

        <div style={{ display: "flex", alignItems: "center", margin: "0.5rem 0" }}>
          {project.authorPhoto && (
            <img
              src={project.authorPhoto}
              alt={project.authorName}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                objectFit: "cover",
                marginRight: "0.5rem"
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <strong>{project.authorName}</strong>
        </div>

        <p style={{
          fontSize: "1.1rem",
          color: "#007bff",
          fontWeight: "bold",
          margin: "0.5rem 0"
        }}>
          {project.totalReceived} CritCoin
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
        <h1 className="gothic-title gothic-text">Leaderboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="artistic-container" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 className="gothic-title gothic-text" style={{ textAlign: "center", marginBottom: "2rem" }}>
        CritCoin Leaderboard
      </h1>

      <p style={{ textAlign: "center", marginBottom: "3rem", fontSize: "1.1rem", color: "#666" }}>
        Top 3 projects with the most CritCoin received in each category
      </p>

      {leaderboard && [1, 2, 3, 4].map(num => {
        const projects = leaderboard[`project${num}`];

        if (!projects || projects.length === 0) {
          return null;
        }

        return (
          <div key={num} style={{ marginBottom: "3rem" }}>
            <h2 style={{
              fontSize: "2rem",
              marginBottom: "1.5rem",
              paddingBottom: "0.5rem",
              borderBottom: "3px solid #007bff"
            }}>
              Project {num}
            </h2>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1.5rem"
            }}>
              {projects.map((project, index) => (
                <ProjectCard key={project._id} project={project} rank={index} />
              ))}
            </div>
          </div>
        );
      })}

      {leaderboard && Object.values(leaderboard).every(projects => projects.length === 0) && (
        <p style={{ textAlign: "center", color: "#999", fontSize: "1.2rem" }}>
          No projects submitted yet. Be the first!
        </p>
      )}
    </div>
  );
}
