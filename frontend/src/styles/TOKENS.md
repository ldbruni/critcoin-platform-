# CritCoin theming — how it works

Four stylesheets, imported in this order from
[App.js](../App.js) (which `index.js` imports **before** `bootstrap.css` — that
ordering is load-bearing, see [Cascade](#cascade)):

| File | Holds |
|---|---|
| `base.css` | Webfont load, box-sizing reset, structural body geometry, the global `@keyframes` registry, the scrollbar, the Classic Mode toggle |
| `theme-rules.css` | Every themed rule body, written once and shared by all themes, driven by tokens |
| `theme-v1.css` | Token **values** for the original design. ❄ Frozen ❄ |
| `theme-v2.css` | Token **values** for the current design |

The split is deliberate: **what differs between themes is token values, not rule
bodies.** Where v2 needs a rule to be *absent* rather than re-valued (the
retired animations), `theme-v2.css` overrides it explicitly.

## Applying a theme

[`<ThemeScope>`](../theme/ThemeScope.js) puts `theme-v1` / `theme-v2` on a
wrapper `<div>`. With `pageLevel`, it also puts `theme-page-v1` /
`theme-page-v2` on `<body>` for the duration of the route.

Two scopes are live at once: one around the nav chrome, one around the page.
That is what lets a Classic Mode archive page render under current-design
chrome.

**Scopes are siblings, never nested.** The rules below all carry equal
specificity, so a nested scope would resolve by stylesheet order rather than by
proximity — v2 would win inside a v1 region.

## Cascade

`bootstrap.css` loads *after* the theme files and beats them on every
equal-specificity element selector. That is not a bug to fix: it is why the app
renders light rather than dark, why `h1` is 2.5rem rather than 3.2rem, and why
body copy is system sans rather than Crimson Text. See
[DESIGN-DNA.md](../../../design-archive/v1/DESIGN-DNA.md) §0.

So `theme-rules.css` scopes with **`:where()`**, which contributes **zero
specificity**:

```css
:where(.theme-v1, .theme-v2) h1 { … }   /* weighs 0,0,1 — same as `h1` */
.theme-v1 h1 { … }                      /* weighs 0,1,1 — would beat bootstrap */
```

The first keeps today's cascade exactly. The second would silently resurrect a
design that has never rendered. **Use `:where()` for anything shared with v1.**

Corollaries:

- Two selectors, not one list, when a list would mix specificities.
  `code, .matrix-text` must stay separate — `:is(code, .matrix-text)` takes the
  *maximum* specificity of its arguments and would steal bootstrap's `code`
  colour.
- v2-only overrides may use plain `.theme-v2 …` selectors. v2 is a fresh design
  with no fidelity obligation, so it is free to beat bootstrap deliberately.

## Where tokens must be declared

Custom properties inherit **downwards only**. Both theme files therefore
declare their token block twice:

```css
.theme-v1,
body.theme-page-v1 { --… }
```

`<body>` needs its own copy because the page background and the fixed
atmosphere layers (`body::before`, `body::after`) are painted on `<body>`,
which sits *above* every wrapper and so can never inherit from one.

The viewport scrollbar sits higher still — on the root element, above `<body>`
— so `base.css` styles it with **literals, not tokens**, and it is global. One
document has one scrollbar; it cannot be v1 in one region and v2 in another.
Classic Mode does not reproduce it.

## Ghost variables — do not define these

Eleven custom properties are referenced by the pages and defined nowhere:

```
--accent-gold      --accent-copper   --accent-blue     --complement-blue
--complement-green --primary-red     --neon-orange     --neon-pink
--neon-cyan        --accent-light    --accent-bright
```

An undefined `var()` with no fallback makes the declaration invalid at
computed-value time: inherited properties fall back to the inherited value,
non-inherited ones to `initial` — so borders silently vanish and text silently
re-inherits its colour. **The v1 design depends on these failures.** Archive
cards have no gold border; all six archive stat values render the same grey
despite being assigned six different colours.

Defining any of them — in *either* theme file — changes what v1 renders.
Instead, when a page is converted to v2, replace each *reference* with a real
token whose v1 value equals the current **effective** rendered value (often
"no border" or the inherited colour).

## Converting a page to v2

1. Swap hardcoded literals in that page's inline `style={{}}` objects for
   `var(--token)`. Inline styles resolve custom properties against the scoped
   cascade, so this works without touching markup.
2. Set the token's v1 value to the exact literal removed — that keeps the
   output byte-identical — and give it an intentional v2 value.
3. **Never tokenize layout properties** (padding, margin, grid, flex, width).
   [mobile-fix.css](../mobile-fix.css) matches on inline-style *strings*
   (`div[style*="padding"]`, `[style*="display: grid"]`); moving those values
   would silently break mobile layout.
4. Record the literal → token mapping for that page below, so a reviewer can
   check the table once and then confirm the diff contains only those swaps.
5. Flip that route's `<ThemeScope>` to `theme="v2"` in the same commit.

Every token `theme-v1.css` defines must also exist in `theme-v2.css`:
unconverted pages still reference legacy names (`--dark-border`,
`--gradient-primary`, …) directly from their inline styles, and would break the
moment their route flips.

## Verifying a change made nothing move

The fidelity harness compares computed styles rather than pixels, because a
dozen infinite animations make raw screenshot diffs meaningless:

1. `git worktree add ../critcoin-v1 design-v1-archive`, junction its
   `frontend/node_modules` to this one, copy `frontend/.env` across.
2. Run **one server at a time on port 3000** — the backend's dev CORS
   allowlist only contains port 3000, so a second frontend on another port
   silently renders empty pages and produces a meaningless "match".
3. For each build, capture: animation properties first, then re-read every
   other property with `animation: none` injected, so values are deterministic
   instead of sampled from a running animation's current phase.
4. Diff per-selector computed styles plus a position-independent multiset of
   whole-tree style fingerprints, at desktop and mobile widths.

Phase 2 result: **zero computed-style differences** on all 15 non-archive page
states; archive pages differ only by `scrollHeight +34px`, the height of the
Classic Mode toggle row.

## Per-page literal → token mappings

*(Added one page at a time during the v2 rollout.)*

### Projects.js (Phase 3 pilot — "Dark Sleek Ledger")

Projects renders under a v2 scope only (no Classic Mode counterpart), so these
are intentional v2 changes, not byte-identical swaps.

| v1 literal | → token | Role |
|---|---|---|
| `#007bff` (active tab, section border) | `var(--primary-blue)` | primary action |
| `#28a745` (send button) | `.btn-coin` class (orange) | the coin action |
| `#f8f9fa`, `#f0f0f0` (idle tab, image bg) | `var(--surface-muted)` | dark inset |
| `#f9f9f9` (submission card) | `var(--surface-card)` | dark panel |
| `#ddd` (borders) | `var(--surface-card-border)` | hairline |
| `"red"` (warnings) | `var(--status-negative)` | danger |
| `#999` (placeholder text) | `var(--text-muted)` | muted text |

Structural additions for the dark direction:
- `.v2-masthead` + `.v2-kicker` wrap the h1 (mono kicker + rule + Grenze
  Gotisch blackletter title).
- `.ledger-num` on every CritCoin amount (balance, totals) — Space Mono,
  tabular.
- Bare `<button>`/`<input>` gained `artistic-btn` / `artistic-input`; the Send
  button is `artistic-btn btn-coin` (RETIRE #5: unstyled defaults join the
  theme).

Layout properties (padding/margin/width) left as literals — mobile-fix.css
matches on those inline-style strings.
