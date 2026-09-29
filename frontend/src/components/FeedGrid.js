// src/components/FeedGrid.js
// The Feed's post grid and its full-size viewer. Shared by the live Feed page
// and the read-only Archive tab, so it renders under both v2 and v1 (Classic
// Mode): every token carries a literal fallback for v1, which defines none of
// these tokens.
//
// Posts arrive without any author field - the API never sends one. The only
// ownership signal is `mineIds`, the ids from the viewer's own signed request.
import React, { useEffect, useRef } from "react";
import { cloudinaryVariant, THUMB, THUMB_2X, FULL } from "../utils/cloudinary";

const C = {
  card: "var(--surface-card, rgba(0, 0, 0, 0.3))",
  border: "var(--surface-card-border, rgba(255, 255, 255, 0.1))",
  inset: "var(--surface-muted, rgba(255, 255, 255, 0.05))",
  muted: "var(--text-muted, rgba(255, 255, 255, 0.6))",
  accent: "var(--accent-orange, #f59e0b)",
  negative: "var(--status-negative, #dc3545)",
  mono: "var(--font-mono, monospace)"
};

export function timeAgo(date) {
  const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function Tag({ children, color }) {
  return (
    <span style={{
      fontFamily: C.mono,
      fontSize: "0.65rem",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color,
      border: `1px solid ${color}`,
      padding: "0.05rem 0.35rem",
      borderRadius: "2px"
    }}>
      {children}
    </span>
  );
}

export default function FeedGrid({ posts, mineIds, onOpen, absoluteDates = false }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
      gap: "0.75rem"
    }}>
      {posts.map((post) => {
        const cover = post.images?.[0];
        const mine = mineIds?.has(post._id);
        return (
          <button
            key={post._id}
            type="button"
            onClick={() => onOpen(post)}
            aria-label={post.text ? `Open post: ${post.text.slice(0, 60)}` : "Open post"}
            style={{
              display: "flex",
              flexDirection: "column",
              textAlign: "left",
              padding: 0,
              background: C.card,
              border: `1px solid ${mine ? C.accent : C.border}`,
              borderRadius: "3px",
              overflow: "hidden",
              cursor: "pointer",
              color: "inherit",
              font: "inherit",
              opacity: post.hidden ? 0.5 : 1
            }}
          >
            {cover && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: C.inset }}>
                <img
                  src={cloudinaryVariant(cover.url, THUMB)}
                  srcSet={`${cloudinaryVariant(cover.url, THUMB)} 400w, ${cloudinaryVariant(cover.url, THUMB_2X)} 800w`}
                  sizes="(max-width: 600px) 50vw, 240px"
                  width={cover.width || undefined}
                  height={cover.height || undefined}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {post.images.length > 1 && (
                  <span style={{
                    position: "absolute", top: "0.4rem", right: "0.4rem",
                    background: "rgba(0, 0, 0, 0.7)", color: "#fff",
                    fontFamily: C.mono, fontSize: "0.7rem", padding: "0.1rem 0.35rem", borderRadius: "2px"
                  }}>
                    1/{post.images.length}
                  </span>
                )}
              </div>
            )}
            <div style={{ padding: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
              {post.text && (
                <p style={{
                  margin: 0,
                  fontSize: cover ? "0.85rem" : "0.95rem",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: cover ? 3 : 8,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word"
                }}>
                  {post.text}
                </p>
              )}
              <div style={{ marginTop: "auto", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.mono, fontSize: "0.7rem", color: C.muted }}>
                  {absoluteDates ? new Date(post.createdAt).toLocaleString() : timeAgo(post.createdAt)}
                </span>
                {mine && <Tag color={C.accent}>Yours</Tag>}
                {post.hidden && <Tag color={C.negative}>Hidden</Tag>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Full-size view of one post. Originals load only here, and still through a
// size-limited, metadata-stripped Cloudinary variant.
export function FeedPostViewer({ post, mine, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!post) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(5, 6, 10, 0.92)",
        overflowY: "auto",
        padding: "3.5rem 1rem 2rem"
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "fixed", top: "0.75rem", right: "0.75rem",
          background: "transparent", color: "#fff",
          border: "1px solid rgba(255, 255, 255, 0.4)", borderRadius: "2px",
          padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "1rem"
        }}
      >
        ✕
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "900px", margin: "0 auto", color: "#e8eaf0" }}>
        {post.images.map((img, i) => (
          <img
            key={img.url}
            src={cloudinaryVariant(img.url, FULL)}
            width={img.width || undefined}
            height={img.height || undefined}
            loading={i === 0 ? "eager" : "lazy"}
            alt=""
            style={{ display: "block", width: "100%", height: "auto", maxHeight: "85vh", objectFit: "contain", marginBottom: "1rem" }}
          />
        ))}
        {post.text && (
          <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "1.05rem", lineHeight: 1.55 }}>
            {post.text}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontFamily: C.mono, fontSize: "0.75rem", color: "#98a1b4" }}>
          {new Date(post.createdAt).toLocaleString()}
          {mine && <Tag color={C.accent}>Yours</Tag>}
          {post.hidden && <Tag color={C.negative}>Hidden by instructor</Tag>}
        </div>
      </div>
    </div>
  );
}
