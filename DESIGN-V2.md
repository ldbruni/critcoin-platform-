# CritCoin design v2

The redesign brief, in one sentence: **a calmer, more legible base layer that
keeps a few signature quirks and lets them land harder because they are no
longer competing.** This is a reduction in volume, not a change in character.
Generic tasteful-startup minimalism is the failure outcome, not the goal.

This document is the plan. It follows the Keep / Tame / Retire buckets approved
at Checkpoint 1 ([design-archive/v1/DESIGN-DNA.md](design-archive/v1/DESIGN-DNA.md)
§3) and the theming machinery built in Phase 2
([frontend/src/styles/TOKENS.md](frontend/src/styles/TOKENS.md)).

---

## 1. The idea

v1 is three design eras shouting at once (medieval chrome, Bootstrap content,
neon remnant) on a light body that only exists by accident. v2 keeps **one**
voice — medieval-manuscript-meets-crypto — and makes the light parchment ground
intentional instead of accidental.

The move is subtraction. Every Keep element is already in v1; v2's work is to
quiet everything around them:

- **One display gesture, not forty.** The blackletter gradient page title
  stays loud. Everything below it becomes legible Cinzel/Crimson on a calm
  ground. The forty ambient animations become one slow wash.
- **One palette, semantically applied.** The blue↔orange identity survives as a
  small set of purposeful roles (primary action, money, danger, muted), not as
  359 unmanaged hex literals plus three colors of glow.
- **The parchment ground, on purpose.** v1's happiest accident — warm/cool
  radial wash under a dark nav — becomes a designed background instead of a
  cascade bug.

---

## 2. Theme values

All values live in [frontend/src/styles/theme-v2.css](frontend/src/styles/theme-v2.css)
as the tokens the Phase 2 rule layer already consumes. Rationale is tied to the
bucket each value serves.

### 2.1 Palette

The hues are unchanged from v1 (KEEP #4 — the blue↔orange identity). What
changes is **saturation discipline**: loud tones become accents, calm tones
become surfaces.

| Token | v1 | v2 | Role / bucket |
|---|---|---|---|
| `--primary-blue` | `#1e40af` | `#1e40af` | unchanged — link/primary action (KEEP) |
| `--primary-blue-light` | `#3b82f6` | `#2563eb` | slightly deeper, better contrast on parchment |
| `--accent-orange` | `#ea580c` | `#ea580c` | unchanged — the warm pole (KEEP) |
| `--surface-page` | *(accidental #fff)* | `#fbf7f0` | **parchment ground, on purpose** (KEEP #4 → intentional) |
| `--surface-page-wash` | *(dark blobs on white)* | `linear-gradient(135deg, #eff4fb 0%, #fbf7f0 45%, #fdf1e7 100%)` | the calm blue→parchment→peach wash (TAME #3) |
| `--surface-card` | white / dark islands | `#ffffff` | one card surface everywhere (TAME #6: no more dark islands in content) |
| `--surface-card-border` | `#dee2e6` / ghost | `#e8ddca` | warm hairline, ties cards to parchment |
| `--surface-muted` | `#f8f9fa` | `#f5eee1` | inset/filter panels, warmed |
| `--text-body` | `#212529` / `#666` | `#2b2620` | warm near-black, primary reading color |
| `--text-muted` | `#6c757d` | `#7a7264` | secondary/meta text |
| `--status-positive` | `#28a745` | `#2f8f4e` | money / success (TAME #5 — kept green, calmed) |
| `--status-negative` | `#dc3545` | `#c0392b` | danger |
| `--status-warning` | `#ffc107` | `#e0921f` | warning, pulled off pure yellow |
| `--status-info` | `#007bff` | `var(--primary-blue)` | folds the Bootstrap blue into the identity blue |

### 2.2 Type scale

KEEP #1 (blackletter gradient h1) and TAME #1–2 (blackletter → h1 only; Cinzel
the official second voice; Crimson the body). The scale gets a real rhythm
instead of 40px-by-accident.

| Token | v2 value | Notes |
|---|---|---|
| `--font-display` | `'Uncial Antiqua', 'Almendra', 'Cinzel', serif` | h1 only now |
| `--font-heading` | `'Cinzel', serif` | h2–h4, nav, labels, buttons (TAME #2) |
| `--font-body` | `'Crimson Text', serif` | body copy, made to actually win over bootstrap in v2 |
| `--font-mono` | `'Space Mono', ui-monospace, 'Cascadia Code', monospace` | addresses/hashes/amounts; picks **one** real mono (RETIRE #4) |
| `--h1-size` | `2.75rem` | the one display moment |
| `--h2-size` | `1.75rem` | Cinzel, not blackletter |
| `--h3-size` | `1.25rem` | |
| `--h4-size` | `1.05rem` | |
| body | `1.05rem / 1.6` | Crimson at a comfortable reading measure |

Because v2 is free to beat bootstrap (it has no fidelity obligation), the h2–h4
rules in `theme-v2.css` use plain `.theme-v2` selectors to drop blackletter and
the gradient-clip down to Cinzel in `--text-body`.

### 2.3 Spacing, borders, shadows

RETIRE #1 (the animation zoo) and TAME #3–4 (one atmosphere, one hover).

| Token | v2 value | Bucket |
|---|---|---|
| `--radius-card` | `10px` | consistent, was 8/12/1rem ad hoc |
| `--card-shadow` | `0 1px 3px rgba(43,38,32,.08), 0 4px 12px rgba(43,38,32,.05)` | one soft shadow, replaces per-card glows |
| `--card-hover-shadow` | `0 4px 16px rgba(43,38,32,.12)` | the single hover lift (TAME #4) |
| `--card-hover-lift` | `translateY(-2px)` | one value, was −2/−3/−4 |
| atmosphere | blobs kept, **slowed to ~90s and dimmed**; grid + particles + pulsing hairline **removed** | TAME #3 / RETIRE #1 |
| shimmer/glow/ripple/scan | **removed** in v2 (rules overridden to `animation: none`) | RETIRE #1 |

### 2.4 Chrome (KEEP #3, unchanged)

The dark gothic nav — dark ground, Cinzel links, blue→orange gradient border,
orange active pill — is a Keep. Its tokens are **identical** in v1 and v2. The
one change: the Admin link's hardcoded magenta `#ff6600→#ff0080`
([App.js:43](frontend/src/App.js#L43)) becomes an on-palette orange gradient
(TAME #7), so magenta leaves the app.

---

## 3. Per-page notes

Nine surfaces. "Keeps" are the same in both themes; the work each page needs is
the tokenization of its inline styles plus removing retired local effects.

1. **Projects** *(the Phase 3 proof)* — tip buttons, project cards, the
   submission form. Bootstrap greys → surface tokens; the `#28a745` send button
   → `--status-positive`; the four project-selector tabs get the calm
   active/idle treatment. h1 "Projects" stays blackletter. Default browser
   buttons (Connect Wallet, Edit) join the button style (RETIRE #5).

2. **Leaderboard** — 🥇🥈🥉 medals **stay** (KEEP #2). Rank cards move to the one
   card surface; the gold/silver/bronze tints calm to warm neutrals with a thin
   status accent; `#007bff` CritCoin totals → `--primary-blue`. h1 stays.

3. **Explorer** — 🔍 title emoji and the tx-type icons 🎨💸💬⚙️➕🔥 **stay**
   (KEEP #2). The four stat tiles stop being four different state colors; they
   become one surface with the value in `--primary-blue` and a small typed
   accent. Table zebra `#fff/#f8f9fa` → `--surface-card/--surface-muted`.
   Adds the missing `artistic-container` scaffold (IA note §5.6) — *flagged,
   not yet done; needs your ok as it is structural.*

4. **Forum** — dark card islands → the light card surface (TAME #6) so posts are
   legible; the pulsing top bar and per-post glow **go** (RETIRE #1). Post
   bodies move from ghost `Space Mono` to the real `--font-mono`. The neon gate
   message ("Initialize Identity Matrix") loses its Orbitron/neon styling
   (RETIRE #2); **its wording is a separate copy decision — see §5.**

5. **Prediction** — question headers stay Cinzel; the vote-count badge keeps its
   orange gradient (on-palette). `--complement-green` ghost → `--status-positive`;
   dark option cards → light surface. "Locked In" state keeps a positive accent.

6. **Profiles** — the neon self-view (Orbitron, cyan card, `--neon-*` ghosts,
   "YOUR DIGITAL IDENTITY") is the loudest RETIRE #2 target: it becomes a normal
   profile card on the light surface. Public profile grid: warm card surface,
   `--primary-blue` copy button, wallet in `--font-mono`.

7. **Bounties** — status pills keep emoji + uppercase (TAME #8), restyled to
   palette; 💰 reward **stays**. Cards → one surface; the info footer calms.

8. **Admin** — every tab header keeps its emoji (KEEP #2). This is the biggest
   inline-style surface (153 hex literals); it becomes surfaces + status tokens.
   Danger-zone controls use `--status-negative` intentionally. Rolled out last.

9. **Home (`/`)** — Dapp boilerplate demo. **Chrome only** (your decision): the
   nav is v2 everywhere; Dapp's body is left as-is under a v1 scope. No content
   work.

---

## 4. What stays exactly (Keep audit)

These must appear in v2 unchanged. If implementing v2 makes me want to alter one,
I stop and ask (Phase 4 rule).

- **Blackletter gradient page titles** — Uncial Antiqua h1 with the navy→blue
  gradient-clip. Every page keeps its `<h1 className="gothic-title gothic-text">`.
- **Emoji icon system** — tx types 🎨💸💬⚙️➕🔥, medals 🥇🥈🥉, bounty status
  🎯✅❌, Admin tab prefixes, 🔍 Explorer, 💰 rewards.
- **Dark gothic nav** — dark ground, Cinzel links, blue→orange gradient border,
  orange active pill.
- **Blue↔orange + parchment identity** — same hues; parchment now intentional.

## 5. Copy decisions needing your call (not in scope without sign-off)

Per the brief, copy changes beyond casing are out of scope. Retiring the neon
*styling* needs no copy change, but these strings read oddly once the cyberpunk
skin is gone — flagging, not changing:

- "Initialize Identity Matrix to broadcast" / "INSUFFICIENT CREDITS … to
  transmit" (Forum gate)
- "YOUR DIGITAL IDENTITY", "WALLET:", "CREDITS:" (Profiles self-view)

Default action: **leave the words, retire the styling.** Tell me if you'd rather
soften the copy too.

## 6. IA debt — still parked

The §5 IA-debt items from the DNA doc (wallet-gating inconsistency on Projects,
the two-row nav, Forum/route/component naming drift, Explorer's missing
scaffold, the Home boilerplate) remain **individually pending your sign-off**.
v2 fixes contrast failures as a side effect of the new tokens, but does not
touch layout/IA without a green light.
