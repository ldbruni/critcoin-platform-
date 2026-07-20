# CritCoin design v1 — archive

- **Date archived:** 2026-07-19
- **Git tag:** `design-v1` (commit `1f08461`)
- **Reference branch:** `design-v1-archive` — never rebased, never updated. It is
  the authoritative copy of the original design.
- **In-app preservation:** past-semester archive pages (`/archive`,
  `/archive/:archiveId`) offer a **Classic Mode** toggle that renders them in
  the v1 design. The mode lives in the URL (`?view=classic`), so it survives a
  refresh and can be linked to; leaving the archive returns to the current
  design.

## Classic Mode fidelity

Verified by comparing computed styles — not pixels, since a dozen infinite
animations make raw screenshot diffs meaningless — against this branch running
side by side. Across the archive list, the detail view and all six tabs, at
desktop and mobile widths, there are **zero computed-style differences**. The
only measured delta is the page being 34px taller, which is the toggle itself.
The method is written up in
[frontend/src/styles/TOKENS.md](../../frontend/src/styles/TOKENS.md).

**What Classic Mode cannot reproduce:** the custom scrollbar. A document has
exactly one viewport scrollbar, painted on the root element above every theme
scope, so it cannot be v1 in one region and v2 in another. It stays global and
follows whatever the live app uses.

## What the v1 design was doing

v1 is three design eras rendered at once: a medieval-manuscript chrome
(blackletter Uncial Antiqua headings with gradient-clipped text, a dark Cinzel
nav, and a zoo of ~24 ambient animations — drifting blobs, a marching grid,
floating particles, shimmer sweeps), a Bootstrap-era light content layer
(white cards, `#007bff`/`#28a745` state colors) living in ~620 inline styles,
and a broken neon-cyberpunk remnant (Orbitron, undefined `--neon-*` variables,
"Initialize Identity Matrix" copy). Its most defining trait is accidental: the
intended dark gothic body is overridden by Bootstrap's white body via CSS
import order, so the app actually renders as a light parchment wash under a
dark nav, with dark card "islands" floating in it — and roughly eleven CSS
variables that were never defined silently erase borders and recolor text.
The full mechanism inventory, frequency map, and structural-vs-skin analysis
are in [DESIGN-DNA.md](DESIGN-DNA.md); as-rendered captures of every page are
in [screenshots/](screenshots/).
