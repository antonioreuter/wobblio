---
name: wobblio-design
description: Use this skill to generate well-branded interfaces and assets for Wobblio, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

Wobblio is a dark-first, glassmorphic personal fiscal-management product ("Obsidian Aurora"). Brand hue is Electric Indigo `#6366F1`; type pairs Outfit (display) + Inter (body); icons are Lucide; the signature surface is frosted glass over deep-space black with drifting aurora blobs.

Key files:
- `readme.md` — the full design guide: content voice, visual foundations, iconography, and a manifest of everything here.
- `styles.css` — global CSS entry point (link this; it `@import`s tokens + base).
- `tokens/` — color, type, spacing, effect custom properties.
- `components/` — React primitives (Button, Badge, Card, Tag, Input, Switch, Checkbox, WobblioLogo, MerchantIcon, Avatar, MetricCard, ProgressBar). Each has a `.prompt.md` with usage.
- `ui_kits/web/` — full landing + workspace recreation.
- `templates/web-app/` — copy-ready starter.
- `assets/` — logo (SVG + raster) and reference renders.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
