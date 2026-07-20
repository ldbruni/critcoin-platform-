# CritCoin design v1 — Design DNA

Analysis of the design as it actually renders at tag `design-v1` (commit
`1f08461`), from direct code study and a full visual pass of every page running
locally (viewport captures in [screenshots/](screenshots/)). This document is
the input to the v2 keep/tame/retire decision.

---

## 0. The single most important finding: v1 is an accident, faithfully loved

`artistic.css` designs a **dark gothic** app: `body { background: var(--dark-bg
/* #0f1729 */) }` with blue/orange radial "blob" overlays, a moving grid, and
floating particles, all tuned for a dark ground
([artistic.css:46–79](../../frontend/src/styles/artistic.css#L46-L79)).

That body background **never renders**. [index.js](../../frontend/src/index.js#L4-L11)
imports `App` (which pulls in artistic.css) *before*
`bootstrap/dist/css/bootstrap.css`, so Bootstrap's `body { background-color:
#fff; color: #212529 }` wins the cascade. The app you actually see is:

- a **white/light body** with the dark-tuned blobs and grid rendering as a
  faint parchment-like blue↔orange wash and hairline graph-paper grid;
- the **dark gothic nav** sitting on top as designed;
- **dark card "islands"** (`.artistic-card`, Forum/Prediction/self-Profile)
  floating on the light ground;
- **light Bootstrap-styled content** (Leaderboard, Bounties, Explorer,
  Projects, public Profiles, Admin, Archive) that happens to sit comfortably on
  the accidental light body;
- h1/h2 gradient-clipped text rendering as **dark navy→blue lettering** (on the
  intended dark ground it would have glowed light).

Three consequences for this project:

1. **v1 = as-rendered, not as-intended.** `theme-v1` must encode the *computed
   result* of the artistic-then-bootstrap cascade (light body), not
   artistic.css's dark intent.
2. The look is **fragile**: reordering two imports would flip the whole app
   dark. The theme refactor must freeze the rendered outcome explicitly.
3. Several "mechanisms" below are half of a dark design being read against the
   wrong background. Whether that tension is charm or noise is exactly the
   keep/tame/retire question.

A sibling accident: **~11 CSS variables are referenced but never defined**
(§1.8). Where they're used, colors silently inherit and borders silently
vanish. v1's rendered look *depends on these failures* (e.g. the Archive
overview's six stat values were each assigned a different color —
[Archive.js:272–277](../../frontend/src/pages/Archive.js#L272-L277) — and all
render as the same inherited grey instead).

## 0.5 The three strata

The quirk is not one system but three, layered by history:

| Stratum | Where it lives | State |
|---|---|---|
| **A. Gothic/medieval chrome** — blackletter, Cinzel, gradients, animation zoo | `artistic.css` classes + element selectors | Active, dominant chrome |
| **B. Bootstrap-era light content** — white cards, `#007bff`/`#28a745`/`#dc3545`/`#ffc107`, grey text | ~620 inline `style={{}}` objects in pages | Active, dominant content |
| **C. Neon-cyberpunk remnant** — Orbitron, `--neon-*` ghosts, "Identity Matrix" copy | Inline styles + copy in Profiles/FormPage | Mostly broken; voice survives |

Every page is some mix of A-chrome + B-content, with C peeking through on
Profiles (self view) and Forum (gate messages).

---

## 1. Inventory of quirk mechanisms

### 1.1 Typefaces (4 loaded, 3 ghosts)

Loaded via one Google Fonts `@import`
([artistic.css:2](../../frontend/src/styles/artistic.css#L2)):

| Font | Assigned role | Where assigned |
|---|---|---|
| **Uncial Antiqua** (insular/blackletter) | ALL headings h1–h6, all `.artistic-btn` | [artistic.css:83](../../frontend/src/styles/artistic.css#L82-L88), [:286](../../frontend/src/styles/artistic.css#L285-L301) |
| **Cinzel** (roman capitals) | nav links; re-declared inline ~50× for sub-headings/labels | [artistic.css:191](../../frontend/src/styles/artistic.css#L190-L203); e.g. [Prediction.js:183](../../frontend/src/pages/Prediction.js#L183), Archive.js ×12, FormPage.js ×12 |
| **Crimson Text** (serif) | body; re-declared inline ~25× | [artistic.css:49](../../frontend/src/styles/artistic.css#L46-L56) |
| **Almendra** | fallback slot in the heading stack; never primary | [artistic.css:83](../../frontend/src/styles/artistic.css#L83) |

**Ghost fonts** — referenced, never loaded, silently fall back to system fonts:
`Fira Code` ([artistic.css:338](../../frontend/src/styles/artistic.css#L338),
[:562](../../frontend/src/styles/artistic.css#L562), FormPage.js), `Space Mono`
(forum post bodies [FormPage.js:455](../../frontend/src/pages/FormPage.js#L455),
Archive.js ×3), `Orbitron` (neon remnant,
[Profiles.js:487–494](../../frontend/src/pages/Profiles.js#L486-L494),
[FormPage.js:365](../../frontend/src/pages/FormPage.js#L365)).

The **blackletter-everything** effect is the loudest single mechanism: because
h1–h6 is an element selector, *every* heading in the app renders in Uncial
Antiqua — page titles, but also bounty card titles ("New York City"), project
titles ("vomit-tile side effects"), Explorer stat labels ("Total
Transactions"), Admin tab headers, archive tab content. See any screenshot.

### 1.2 Gradient-clipped, animated heading text

h1/h2 use `background-clip: text` + `-webkit-text-fill-color: transparent`
over `--gradient-primary`/`--gradient-accent` with an infinite `gradientShift`
animation and layered text-shadow
([artistic.css:90–115](../../frontend/src/styles/artistic.css#L90-L115)).
On the accidental light body this renders as glossy **dark-navy lettering**
with a soft glow — the de facto CritCoin title treatment
([screenshots/leaderboard.png](screenshots/leaderboard.png)).
Failure mode: inside dark cards the same dark gradient is nearly invisible
(Forum's "Wallet Connection Required",
[screenshots/forum.png](screenshots/forum.png)).

### 1.3 Color palettes (one real, two ghost, one Bootstrap)

**Active gothic palette** — the `:root` block,
[artistic.css:4–39](../../frontend/src/styles/artistic.css#L4-L39):
blues `#1e40af / #3b82f6 / #60a5fa / #93c5fd`, oranges `#ea580c / #f97316 /
#fb923c / #fdba74`, darks `#0f1729 / #1a2332 / #243242`, border-blue
`#2563eb`, parchment `#fef7ed`, plus 9 composed gradients and 3 shimmer rgbas.

**Bootstrap-era inline palette** — 359 hex literals across the 9 page files
(counts: Admin 153, Archive 64, Profiles 53, Explorer 37, Bounties 31,
Projects 12, Leaderboard 7, Prediction 2): `#007bff` (primary actions/links),
`#28a745` (money/success), `#dc3545` (danger), `#ffc107` (warning), `#6c757d`/
`#666`/`#333` (grey text), `#f8f9fa`/`#dee2e6`/white (card surfaces). E.g. the
Explorer stat tiles use all four state colors in a row
([Explorer.js:178–215](../../frontend/src/pages/Explorer.js#L165-L218)).

**Ghost palettes** — never defined anywhere (§1.8): the "metallic" set
(`--accent-gold`, `--accent-copper`, `--accent-blue`, `--complement-blue`,
`--complement-green`, `--primary-red`) used ~45× in Archive/FormPage/
Prediction/Profiles/Dapp; the neon set (`--neon-orange`, `--neon-pink`,
`--neon-cyan`) in FormPage/Profiles; plus `--accent-light` and
`--accent-bright` inside artistic.css itself
([:119](../../frontend/src/styles/artistic.css#L119),
[:352](../../frontend/src/styles/artistic.css#L352)).

### 1.4 The animation zoo

~24 `@keyframes` in artistic.css; on any given page **10+ infinite animations
run simultaneously**:

| Device | Selector / keyframe | Cite |
|---|---|---|
| Drifting radial blobs (25s) | `body::before` / `backgroundShift` | [artistic.css:59–79](../../frontend/src/styles/artistic.css#L58-L79) |
| Marching 50px grid (20s) | `body::after` / `gridMove` | [:671–690](../../frontend/src/styles/artistic.css#L670-L690) |
| Floating particle dots (18s) | `.artistic-container::after` / `enhancedFloat` | [:475–527](../../frontend/src/styles/artistic.css#L474-L527) |
| Pulsing top hairline | `.artistic-container::before` / `pulse` | [:443–452](../../frontend/src/styles/artistic.css#L443-L452) |
| Heading gradient drift | h1/h2 / `gradientShift` | [:102](../../frontend/src/styles/artistic.css#L102) |
| Title shimmer sweep | `.gothic-title::before` / `gothicShimmer` | [:130–154](../../frontend/src/styles/artistic.css#L130-L154) |
| Nav border shimmer (8s) | `.artistic-nav` / `navShimmer` | [:179](../../frontend/src/styles/artistic.css#L179) |
| Active-link glow pulse | `.nav-link.active` / `activeGlow` | [:239](../../frontend/src/styles/artistic.css#L232-L240) |
| Card/button/form background drift | `cardGradient` 10s, `buttonGradient` 6s, `formGradient` 12s | [:253](../../frontend/src/styles/artistic.css#L253), [:300](../../frontend/src/styles/artistic.css#L300), [:376](../../frontend/src/styles/artistic.css#L376) |
| Input focus glow pulse | `.artistic-input:focus` / `inputGlow` | [:350–359](../../frontend/src/styles/artistic.css#L350-L359) |
| Matrix scanline on `code` | `code::before` / `matrixScan` | [:569–583](../../frontend/src/styles/artistic.css#L559-L583) |
| Button ripple ::before/::after | `.artistic-btn` | [:318–334](../../frontend/src/styles/artistic.css#L318-L334), [:632–648](../../frontend/src/styles/artistic.css#L632-L648) |
| Forum post pulsing top bar | inline `animation: 'pulse 3s...'` | [FormPage.js:396](../../frontend/src/pages/FormPage.js#L389-L397) |
| Hover lifts `translateY(-2…-4px)` | nav/cards/buttons + inline `onMouseOver` | [:229](../../frontend/src/styles/artistic.css#L229), [:261](../../frontend/src/styles/artistic.css#L261), [Bounties.js:209](../../frontend/src/pages/Bounties.js#L209), [Archive.js:158–165](../../frontend/src/pages/Archive.js#L158-L165) |

Unused extras: `float`, `floatGentle`, `lightGradientMove`,
`brightGradientMove`, `contentBackgroundShift`, `parchmentFlow` (+ classes
`.animated-light-bg`, `.parchment-animated-bg`, `.content-animated-bg` with no
call sites).

### 1.5 The dark chrome

Sticky two-row nav: dark gradient, blur, animated blue→orange gradient
border-bottom, Cinzel links in pill boxes, orange-gradient active state
([artistic.css:167–240](../../frontend/src/styles/artistic.css#L166-L240);
markup [App.js:27–52](../../frontend/src/App.js#L27-L52)). The Admin link
carries a one-off **hot inline gradient `#ff6600 → #ff0080`**
([App.js:42–46](../../frontend/src/App.js#L42-L46)) — the only magenta in the
app. Global **gradient webkit scrollbar**
([:651–668](../../frontend/src/styles/artistic.css#L650-L668)).

### 1.6 Emoji as iconography (structural)

143 emoji across 12 source files, in JSX strings (not a component —
[Emoji.js](../../frontend/src/components/Emoji.js) exists but is unused):

- **Functional icon systems:** transaction type icons 🎨💸💬⚙️➕🔥📝
  (`getTypeIcon()`, duplicated in
  [Explorer.js:150](../../frontend/src/pages/Explorer.js#L148-L157) and
  [Archive.js:106](../../frontend/src/pages/Archive.js#L104-L113)); leaderboard
  medals 🥇🥈🥉 ([Leaderboard.js:34](../../frontend/src/pages/Leaderboard.js#L34),
  [Archive.js:541](../../frontend/src/pages/Archive.js#L541)); bounty status
  🎯✅❌📝 ([Bounties.js:91](../../frontend/src/pages/Bounties.js#L89-L96)).
- **Title/section prefixes:** 🔍 CritCoin Explorer
  ([Explorer.js:162](../../frontend/src/pages/Explorer.js#L162)); 🛡️ Admin
  Panel, and every Admin tab: 📊 👥 💬 🎨 🎯 🔐 📦 🚀 🗑️ ⚠️
  ([Admin.js:851–1937](../../frontend/src/pages/Admin.js#L851)).
- **Inline accents:** 💰 rewards, 💡 hints, 📋 explainer, 📱 mobile hint, ⚠️
  warnings.
- (Also ~80 emoji in `console.log` diagnostics — invisible to users, not a
  design mechanism.)

### 1.7 Voice & casing

- **Gothic register:** plain title case page titles ("Semester Archives",
  "Prediction Market") — the blackletter font supplies the drama, the words
  don't.
- **Neon register (remnant):** ALL-CAPS techno-speak on Profiles self-view and
  Forum gates: "YOUR DIGITAL IDENTITY", "WALLET:", "CREDITS:",
  "⚠️ PROFILE REQUIRED — Initialize Identity Matrix to broadcast",
  "⚠️ INSUFFICIENT CREDITS — Need ≥1 CritCoin to transmit"
  ([Profiles.js:488–494](../../frontend/src/pages/Profiles.js#L486-L494),
  [FormPage.js:365–368](../../frontend/src/pages/FormPage.js#L365-L368)).
- **Instructor-friendly register:** warm plain prose with exclamation marks
  ("Check back later for new bounties from your instructor!", "No projects
  submitted yet. Be the first!").
- **Status pills:** `UPPERCASE` + emoji ("🎯 ACTIVE",
  [Bounties.js:251](../../frontend/src/pages/Bounties.js#L251)).

### 1.8 Ghost variables (load-bearing bugs)

Referenced ~50×, defined 0×: `--accent-gold`, `--accent-copper`,
`--accent-blue`, `--complement-blue`, `--complement-green`, `--primary-red`,
`--neon-orange`, `--neon-pink`, `--neon-cyan`, `--accent-light`,
`--accent-bright`. Effect of an undefined `var()` with no fallback: the
declaration is invalid at computed-value time — **inherited properties fall
back to the inherited value, non-inherited ones to `initial`** (borders
vanish). Rendered consequences include: author names in forum posts inherit
white instead of gold ([FormPage.js:433](../../frontend/src/pages/FormPage.js#L430-L437));
vote-pill borders exist only as green/red *text* color where the color is a
literal and vanish where it's a ghost; the archive-list card border is absent
([Archive.js:132](../../frontend/src/pages/Archive.js#L132)); all six archive
stat values render one grey
([Archive.js:272–277](../../frontend/src/pages/Archive.js#L272-L277)).
**v1 fidelity requires these stay broken** — defining them would change the
current look.

### 1.9 The unstyled stragglers

Scattered default browser buttons/inputs belong to no system: Projects'
"Connect Wallet" / "Edit Submission"
([Projects.js:260](../../frontend/src/pages/Projects.js#L260),
[:323](../../frontend/src/pages/Projects.js#L323)), Admin's connect button,
Profiles' "Edit". Visible in [screenshots/projects.png](screenshots/projects.png),
[admin.png](screenshots/admin.png).

---

## 2. Frequency map

| Mechanism | Pervasiveness |
|---|---|
| Blackletter headings (element selector) | **Every heading on every page** |
| Gradient-clip animated h1/h2 | Every page title |
| Light body + faint blobs/grid (the accident) | Every page |
| Dark nav chrome + gradient border | Every page |
| Bootstrap light cards & palette | Content layer of 7 of 10 surfaces (Leaderboard, Bounties, Explorer, Projects, public Profiles, Admin, Archive tabs) |
| Dark `.artistic-card` islands | Forum, Prediction, self-Profile, wallet-gate cards |
| Emoji iconography | Explorer, Archive, Bounties, Leaderboard, Admin (every tab), accents everywhere |
| Animation zoo (shimmer/glow/drift) | Chrome: every page. Content: Forum post bars, hover lifts |
| Cinzel inline sub-headings | Forum, Prediction, Archive, Profiles (~50 declarations) |
| Ghost-var breakage | Archive, Forum, Prediction, Profiles, Dapp |
| Neon remnant (Orbitron + caps voice) | Profiles self-view, Forum gate messages only |
| Gradient scrollbar | Global |
| Unstyled default buttons | Projects, Admin, Profiles (occasional) |

---

## 3. Keep / Tame / Retire proposal

Judgment applied: CritCoin's identity = **medieval-manuscript-meets-crypto**
(blackletter + parchment wash + blue/orange) with **emoji as the icon
language**. What's noise is the *ambient motion*, the third (neon) voice, and
the unmanaged Bootstrap grey-blue defaults that dilute both.

### KEEP — signature moves, full strength in v2

1. **Blackletter page titles with the gradient-clip treatment.** Uncial
   Antiqua + navy→blue gradient text for the h1 of every page. This is the
   logo-in-place; nothing else on the internet looks like CritCoin's
   "CritCoin Leaderboard". (Scoped to page titles — see Tame #1.)
2. **Emoji as the app's icon system.** Transaction types 🎨💸💬⚙️➕🔥, medals
   🥇🥈🥉, bounty status, Admin tab prefixes. Functional, charming, structural
   — and it costs nothing in visual noise because it rides inside text.
3. **The dark gothic nav** — dark ground, Cinzel links, blue→orange gradient
   border-bottom, orange active pill. The one dark element that *should* stay
   dark: it frames every page and carries the palette poles.
4. **The blue↔orange dual-hue identity + parchment-wash light body.** The
   accidental light ground with the faint warm/cool radial wash is, honestly,
   nicer than the intended dark theme — keep it *on purpose* in v2 (as a
   designed gradient, not as a cascade bug).

### TAME — present, at lower volume

1. **Blackletter scope:** h1 only. Card titles, stat labels, tab headers,
   buttons drop to Cinzel (headings/labels) and Crimson Text (body). Kills the
   "New York City in monk-script" effect while making the h1 land harder.
2. **Cinzel** becomes the *official* second voice (section headings, nav,
   labels) — defined once in the theme, not re-declared inline 50×.
3. **Ambient motion → one slow layer.** Keep the radial blob wash (static or
   very slow), **retire** the marching grid, particles, and pulsing hairline.
   One atmosphere, not four.
4. **Hover lifts:** keep a single subtle `translateY(-2px)` + shadow on
   interactive cards/buttons; one implementation via the theme, not inline
   handlers.
5. **The Bootstrap state palette** (blue/green/red/yellow) → survives as
   *semantic tokens* re-tuned to the CritCoin blues/oranges (money-green can
   stay green; primary-action blue shifts to the palette blue).
6. **Dark islands:** the dark card treatment survives as an *accent* (e.g.
   wallet-gate cards), not as whole-page content style; Forum/Prediction
   content moves onto the light ground for legibility.
7. **Admin-link hot gradient** → keep the idea (Admin link looks dangerous),
   re-tuned to palette (orange gradient), not magenta.
8. **Status pills** keep emoji + uppercase, restyled to palette.

### RETIRE — the ambient noise

1. **The shimmer/glow/ripple animation zoo:** `gothicShimmer`, `navShimmer`,
   `activeGlow`, `inputGlow`, `matrixScan`, `cardGradient`, `buttonGradient`,
   `formGradient`, `formBorderShimmer`, button ripples, forum post pulsing
   bars, heading `gradientShift` (gradient stays, drift goes). Plus the six
   unused keyframes/classes.
2. **The neon-cyberpunk stratum:** Orbitron references, `--neon-*` ghosts, the
   `rgba(0,255,255)` cyan card. (The *copy* — "Initialize Identity Matrix",
   "YOUR DIGITAL IDENTITY" — is a casing/voice call flagged for your decision
   at checkpoint; retiring the styling doesn't require touching the words.)
3. **Ghost variables** — all ~11 replaced by real tokens whose v1 value equals
   the current *effective* rendered value (so Classic Mode keeps the broken
   look faithfully) and whose v2 value is intentional.
4. **Ghost fonts** (`Fira Code`, `Space Mono`, `Orbitron` references) — v2
   picks one real monospace stack for addresses/hashes/code and loads it or
   uses system mono deliberately.
5. **Unstyled default browser buttons** — everything joins the theme.
6. **The gradient scrollbar** — small, but it's chrome-noise; default
   scrollbar in v2. (Cheap to keep if you disagree.)
7. **`mobile-fix.css` legacy rules** that target a nav that no longer exists
   (`h1 + p a` link-pill styling,
   [mobile-fix.css:114–178](../../frontend/src/mobile-fix.css#L114-L178)) —
   dead weight, retire with care after mobile re-test.

---

## 4. Structural vs. skin — honest assessment

**Mostly skin, with a countable structural core.**

- **Skin (CSS/theme-reachable):** fonts, all colors/gradients/shadows, the
  entire animation zoo, nav styling, card styles, scrollbar. This includes the
  ~620 inline styles: their *values* are hardcoded, but because they are
  inline **style properties**, swapping literals for `var(--token)` references
  reaches them without touching markup structure.
- **Structural (markup/JSX, a theme cannot reach):**
  1. emoji strings in JSX (§1.6) — but these are proposed **Keep**, so they're
     in both themes anyway;
  2. copy voice/casing (§1.7);
  3. the two-row nav markup;
  4. which element is a dark island vs light card — *decided per-element in
     inline styles*, so it flips with tokens, but a v2 that merges Forum's
     dark cards onto the light ground is a value change, not a layout change;
  5. page layout/hierarchy (§5 — separate sign-off).

**Classic Mode verdict:** for the archive pages it **can be a theme swap at
high fidelity**, because [Archive.js](../../frontend/src/pages/Archive.js) is
fully self-contained (it re-implements its profiles/projects/leaderboard/forum/
explorer sections internally) and its markup persists in both modes. The
structural devices that appear in Archive (emoji icons, medals) are Keep
items, present in both themes. If any structurally-rendered device *were*
retired in v2's archive styling, it would need a small `classic ? … : …`
conditional — currently I expect **zero to a handful** of these. Two caveats
for the fidelity target:

1. `theme-v1` must reproduce the **rendered accident** (light body under dark
   chrome), not artistic.css's dark intent (§0).
2. Ghost variables must remain undefined (or explicitly `initial`) inside the
   v1 scope so the broken-border/inherited-color look is preserved (§1.8).

## 5. IA debt notes (separate sign-off, not part of keep/tame/retire)

1. **Home (`/`) is the Hardhat boilerplate demo** — first nav item leads to a
   wallet playground that says "No Ethereum wallet was detected." for most
   visitors. (Per project decision: v2 restyles chrome only here.)
2. **Wallet-gating inconsistency:** Projects hides *all* submissions behind
   Connect Wallet ([Projects.js:259](../../frontend/src/pages/Projects.js#L259)),
   while Bounties/Profiles/Prediction show public content ungated. Students
   without MetaMask on a given device see an empty Projects page.
3. **Contrast failures** (would be fixed by v2 values, listed for the record):
   dark-navy gradient h2 inside dark cards (Forum/Prediction "Wallet
   Connection Required"); white text on light archive-list cards ("Archived:
   January 5, 2026" is nearly invisible,
   [screenshots/archive-list.png](screenshots/archive-list.png)); grey archive
   stat tiles with white labels; sub-title link-blue on wash.
4. **Two-row nav grouping is arbitrary** (Home/Profiles/Projects/Leaderboard
   vs Explorer/Forum/Bounties/Prediction/Archive) and costs 150px of sticky
   header.
5. **Naming drift:** nav says "Forum", route is `/forum`, component is
   `FormPage`, title is "CritCoin Forum".
6. **Explorer lacks `artistic-container`**
   ([Explorer.js:161](../../frontend/src/pages/Explorer.js#L160-L162)) — no
   top hairline/particles; one page is subtly on a different scaffold.
7. **Archive detail duplicates five pages' markup** inside one 1023-line file
   — maintenance debt, though it is precisely what makes Classic Mode cheap.
8. **Leaderboard/Archive duplicate** `getTypeIcon`/medal/card patterns rather
   than sharing components.

---

*Written 2026-07-19 against tag `design-v1`. Screenshots: viewport captures at
1440×900, animations frozen, wallet disconnected (data from the live dev DB).*
