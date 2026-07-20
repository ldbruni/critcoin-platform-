# CritCoin design v2 — "Dark Sleek Ledger"

The redesign brief: **a calmer, more legible base layer that keeps a few
signature quirks and lets them land harder.** At Checkpoint 2 the direction
sharpened — the first (light parchment) draft read as a quieting of v1 rather
than something new, so v2 is now a committed, professional, **dark** system that
*elevates* three v1 ideas instead of merely toning them down:

- the **gothic blackletter** → a sharp modern-blackletter hero masthead;
- the **blue ↔ orange** identity → a disciplined duotone on near-black;
- the **coin / ledger** → monospace, tabular numerals everywhere a value appears.

This is a single dark visual world by choice (like a committed neon or
letterpress design). There is no light variant and no OS-theme switch in the
app; Classic Mode swaps the whole scope back to `theme-v1`.

Built on the Phase 2 machinery ([frontend/src/styles/TOKENS.md](frontend/src/styles/TOKENS.md)):
values live in [theme-v2.css](frontend/src/styles/theme-v2.css) as tokens the
shared rule layer consumes, plus real-specificity `.theme-v2` overrides for the
things that must beat bootstrap.

---

## 1. Theme values

### 1.1 Palette — duotone on near-black

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0d0f14` | page ground (cool near-black) |
| `--panel` | `#161a24` | card surface |
| `--panel-2` | `#1c2130` | inputs / insets |
| `--line` | `#2a3040` | hairline borders |
| `--text` | `#e8eaf0` | primary text (cool near-white) |
| `--text-muted` | `#98a1b4` | secondary text |
| `--primary-blue` | `#5b8cff` | primary action, links, focus |
| `--accent-orange` | `#ff7a2f` | the coin action + active accent |
| `--status-positive / -negative` | `#3ecf8e` / `#ff5f56` | money / danger, used sparingly |

Atmosphere is static, not animated: two faint corner glows (blue top-left,
orange top-right) plus a low-opacity 40px **ledger grid** — the one v1 idea the
light draft retired, brought back here because a precise grid *is* the ledger
sharpness on a dark ground.

### 1.2 Type — three deliberate voices

| Role | Face | Notes |
|---|---|---|
| Hero masthead | **Grenze Gotisch** | a modern, angular blackletter — sharp, not medieval-kitsch. h1 only. |
| UI + body | **Archivo** | sturdy grotesque; headings tight and heavy, labels uppercase + tracked |
| Ledger data | **Space Mono** | every CritCoin amount, wallet, and hash; `tabular-nums` |

The masthead is structured like an exhibition title: a mono kicker
(`CRITCOIN · PROJECTS`) over a hairline rule, then the blackletter title in
solid near-white (`.v2-masthead` / `.v2-kicker`). No gradient drift, no shimmer.

### 1.3 Surfaces, buttons, motion

- **Cards**: `--panel` with a 1px `--line` border, 3px radius, no shadow; hover
  lifts the border to blue rather than glowing.
- **Buttons — outline → invert**: transparent with a 1px accent border and an
  uppercase tracked label; hover fills solid and the label goes dark. Primary =
  blue; the **coin action** (Send CritCoin) = orange (`.btn-coin`). Sharp 2px
  radius, `:focus-visible` ring, ripple/glow removed.
- **Inputs**: mono, dark inset, 1px border; focus draws a crisp blue ring.
- **Nav**: a crisp dark bar; uppercase Archivo links; the active link gets a
  sharp **orange underline** instead of the v1 glow pill. Admin link is solid
  orange (was magenta).
- **Motion**: the whole v1 animation zoo (shimmer, glow, drift, ripple, scan,
  pulsing hairline, particles) is retired.

---

## 2. Per-page rollout notes

Keeps carry across every page: the **blackletter masthead**, the **emoji icon
system** (🎨💸🥇 — dark-ground legible), the **blue/orange duotone**, and the
**dark chrome** (now the whole app, not just the nav).

1. **Projects** *(the pilot, done)* — masthead, mono ledger numerals, outline→
   invert buttons (blue edit / orange send), sharp dark cards, blue tabs.
2. **Leaderboard** — 🥇🥈🥉 kept; rank cards on `--panel`, totals in mono; the
   gold/silver/bronze tints become thin rank-accent rules.
3. **Explorer** — tx-type emoji kept; the four stat tiles become one dark panel
   row with mono values; table zebra → `--bg`/`--panel`. (Adds the missing
   `artistic-container` scaffold — flagged, needs your ok, it is structural.)
4. **Forum** — dark is now native, so posts read cleanly; post bodies in mono;
   the neon gate loses its styling (copy is a separate call — §4).
5. **Prediction** — question headers in Archivo; vote badge in orange; ghost
   `--complement-green` → `--status-positive`.
6. **Profiles** — the neon self-view collapses into a clean dark profile card;
   wallet in mono.
7. **Bounties** — status pills keep emoji + uppercase, restyled; 💰 kept.
8. **Admin** — tab emoji kept; the largest inline-style surface → panels + mono
   data; danger controls in `--status-negative`. Rolled out last but one.
9. **Home (`/`)** — Dapp boilerplate demo. Chrome only (your decision).
10. **Archive** — tokenized last; its Classic path must keep matching v1 exactly
    (re-verified after).

---

## 3. Keep audit

Must appear in v2, elevated not dropped. If implementing makes me want to alter
one, I stop and ask.

- **Blackletter page titles** → elevated to a sharp Grenze Gotisch masthead.
- **Emoji icon system** → kept, on the dark ground.
- **Dark gothic chrome** → elevated from "just the nav" to the whole app.
- **Blue ↔ orange** → a disciplined duotone.

*(Note: the v1 gradient-clipped title fill is not carried into v2 — the masthead
is solid near-white for sharpness. Flag me if you want the duotone gradient back
on the title.)*

## 4. Copy calls needing your sign-off

Retiring the neon *styling* needs no copy change, but these read oddly once the
cyberpunk skin is gone (out of scope to change without a green light):

- "Initialize Identity Matrix to broadcast" / "INSUFFICIENT CREDITS … transmit"
- "YOUR DIGITAL IDENTITY", "WALLET:", "CREDITS:"

Default: keep the words, retire the styling.

## 5. IA debt — parked, needs individual sign-off

Wallet-gating inconsistency on Projects, the two-row nav, Forum/route/component
naming drift, Explorer's missing scaffold, the Home boilerplate. v2 fixes
contrast as a side effect; it does not touch layout/IA without a green light.
