# Wobblio Design System — "Obsidian Aurora"

A complete, compiler-ready design system for **Wobblio**, a cloud-native personal fiscal-management product. Photograph a receipt → multimodal AI turns it into structured financial data; anonymized price points feed a crowdsourced regional price index that powers Wobblio's differentiators (Anti-Inflation Price Engine, Split-Route Shopping Optimizer, proactive budget protection).

The visual language is **Obsidian Aurora**: a premium, dark-first glassmorphism system with a Solar Light alternate. It positions Wobblio as a deliberate, high-end *instrument* for household finance — not a flat SaaS dashboard or a ledger-paper metaphor.

- **Launch market:** Netherlands, Eindhoven region.
- **Products:** Next.js + Tailwind web app (command center, billing, admin) and a backlogged Flutter capture app (not yet designed — intentionally omitted here).

## Sources

This system was reverse-engineered from the Wobblio repository. If you have access, explore these to build richer, more accurate designs:

- **GitHub:** [`antonioreuter/wobblio`](https://github.com/antonioreuter/wobblio) — the product monorepo.
  - `new-web-design-gemini/` — the **Obsidian Aurora** HTML/CSS prototype (`styles.css`, `index.html`), `design-rationale.md`, and `wobblio_design_handover_specification.md`. **This is the canonical design source** and nearly every token here is lifted verbatim from it.
  - `Source/webapp/` — the Next.js implementation (marketing components, auth, dashboard, design-system page).
  - `docs/wobblio_v2.4_specification_final.md` & `specs/mvp/` — the authoritative product spec (personas, quotas, GDPR, pricing).

> Note: the source pairs **Outfit** + **Inter** from Google Fonts. We load them from the Google Fonts CDN (`tokens/fonts.css`) rather than self-hosting, so no `@font-face` binaries ship in this project. Swap in self-hosted `.woff2` files if you need fully offline rendering.

---

## Content Fundamentals

How Wobblio writes. Match this voice in every label, headline, and microcopy string.

- **Voice:** confident, plain-spoken, a little wry. It sells *outcomes*, not features. The tagline is **"Scan your receipts. Outsmart inflation."** — short declarative sentences, often paired.
- **Person:** second person ("**your** receipts", "**you** can save"). The product refers to itself as "Wobblio", never "we" in UI copy.
- **Headlines:** sentence case with a hard stop. Pairs of short sentences are the signature rhythm: *"Same basket, 22% cheaper."*, *"One photo. Tap who had what."*, *"Inflation is personal."*
- **Persona hooks:** italicized, quotation-marked one-liners that dramatize a pain — *"Every receipt converted on the day you paid — not when the bank felt like it."* Always concrete, never abstract.
- **Overlines / eyebrows:** ALL-CAPS, tracked, 2–3 words ("SMART EXPENSE INGESTION", "CAPABILITIES", "USE CASES").
- **Numbers are the hero.** Real euro amounts, percentages, and durations carry the message: "€642.30", "↓ €86.12 below projection", "< 8 seconds", "22% cheaper". Always `€` prefix, two decimals for money, `tabular-nums` so columns align.
- **Status language:** terse system states — "Processed", "Needs Review", "Auto Parsed", "Over Budget".
- **Trust copy** is direct and reassuring: "No bank connection required", "GDPR-compliant, EU-hosted, delete anytime", "Only anonymized prices are ever shared." Privacy is a feature, stated flatly.
- **Casing:** sentence case for everything except eyebrows/overlines and `BADGE` pills (uppercase). Buttons are Title-ish sentence case ("Start Ingesting Free", "Optimize List Now").
- **No emoji** in product UI chrome. (The source uses an occasional 🎉/💡/🏆 in playful inline advisor bubbles and savings banners only — keep these rare and never in navigation, labels, or headings.)
- **Tone guardrails:** never alarmist except for genuine danger states (budget breach, RLS bypass). Avoid hype words ("revolutionary"), avoid jargon in marketing, but *do* expose real technical affordances to developers (the RLS sandbox toggle, `usr_9a4f210e`).

---

## Visual Foundations

- **Mood:** dark-first, deep-space black (`#05060B`) base with soft aurora glow. Premium, calm, instrument-like. A **Solar Light** theme (`#F1F5F9`) is a first-class toggle, not an afterthought.
- **Color:** one brand hue — **Electric Indigo `#6366F1`** — plus a tight semantic set: **Aurora Teal `#0D9488`** (success / safe / under budget), **Warm Amber `#F59E0B`** (review / low confidence / nearing limit), **Sunset Coral `#F43F5E`** (danger / over limit / bypass). Text is **Star White → Slate `#94A3B8` → Muted `#64748B`**. Retailers carry their own brand colors in merchant badges (AH cyan, Jumbo amber, Dirk red, Lidl violet, etc.). See `tokens/colors.css`.
- **Type:** **Outfit** (geometric, rounded-terminal sans) for display — titles, metrics, financial totals, weights up to 800. **Inter** for body and dense controls. Headings track tight (`-0.02em`); the hero tracks tighter (`-2px`) and uses an indigo→white gradient text fill. All money uses `font-variant-numeric: tabular-nums`, right-aligned.
- **Backgrounds:** never flat. Three large radial-gradient **aurora blobs** (indigo, teal, coral) sit at `z-0`, blurred ~120px, drifting on a slow 15–18s alternate animation, `pointer-events:none`. No photographic backgrounds, no repeating patterns. Imagery, when present, is the user's own receipt photos (grayscale + a scanning laser beam during parse).
- **Glass:** the signature surface. `rgba(13,17,30,0.72)` fill, **1px hairline border** `rgba(255,255,255,0.07)`, `backdrop-filter: blur(20px) saturate(160%)`, 16px radius, soft drop shadow plus a faint inset highlight. Light mode inverts to `rgba(255,255,255,0.72)` over a slate hairline. Use `.glass`; add `.glass-interactive` for clickable cards.
- **Corner radii:** 6 (tags) · 8 (inputs, merchant badges, list rows) · 12 (buttons, dropzones) · 16 (cards) · 20 (app shell) · pill (badges, nav). Nothing is fully sharp; nothing is cartoonishly round.
- **Elevation:** shadow-driven, not border-driven. `--card-shadow` is a long soft drop + inset hairline. Interactive cards add a colored glow (`--shadow-brand-glow`) on hover.
- **Borders:** thin and translucent — `--glass-border`. They define edges quietly; color and shadow do the heavy lifting. Hover shifts a border toward indigo (`--glass-hover-border`).
- **Motion:** restrained and physical. Standard easing is `cubic-bezier(0.25, 0.8, 0.25, 1)`. Cards fade-and-rise in (`translateY(8px)→0`). The hero mockup floats gently; the aurora pulses; the parse scanner sweeps a laser line. Progress/budget bars animate width over 0.8s. The danger RLS toggle pulses a coral halo. Everything respects `prefers-reduced-motion`.
- **Hover states:** borders brighten toward indigo, interactive cards lift `translateY(-4px)` with a glow, buttons lift `-1px` and deepen fill, icon buttons scale `1.05` and tint to brand, table rows wash to a faint highlight.
- **Press / active states:** filled controls darken (`--brand` → `--brand-hover`); the active nav/rail item becomes a solid indigo chip with a glow.
- **Transparency & blur** are used deliberately: glass panels, the frosted sticky header (`blur(16px)`), full-screen overlays (`blur(8px)`), and drawers (`blur(30px)`). Blur signals *layering / depth*, never decoration.
- **Layout:** centered max-widths (1200 marketing / 1300 header / 1440 app). The web app is an 80px icon **rail** + fluid body inside a single rounded glass "shell". Generous 24px gutters. Mobile-first responsive: stacks to one column < 900px, ≥44px touch targets.
- **Cards** = frosted glass, 16px radius, hairline border, soft shadow — the answer to "what does a container look like?" is almost always `.glass`.

---

## Iconography

- **System:** [**Lucide**](https://lucide.dev) — thin (≈1.8–2.2 stroke), rounded line-cap, 24×24 outline icons. This is the single icon language across marketing and app.
  - In the source Next.js app they're `lucide-react`; the prototype uses `data-lucide` + the Lucide CDN. In this design system the same glyphs are reproduced as inline SVG in `ui_kits/web/Icons.jsx` (`window.WobblioIcons`) so kits have zero runtime icon dependency. For new work you may also link Lucide from CDN.
- **Merchant icons:** retailers are **never** shown with emoji. Each is a rounded-square badge in the store's brand color holding a representative Lucide glyph (Albert Heijn → shopping-bag on cyan, Jumbo → cart on amber, Dirk → tag on red, Lidl → coins on violet, Tokomania → flame on green, Cantinho → utensils on rose). Unknown merchants fall back to a neutral receipt glyph. See the `MerchantIcon` component.
- **Emoji:** avoid in chrome. The only sanctioned use is the occasional celebratory/insight accent (🎉 💡 🏆) inside playful advisor bubbles, savings banners, and "cheapest basket" badges — rare and never structural.
- **Unicode glyphs** appear as lightweight affordances: `✓` in checkboxes, `×` to remove a tag/close a banner, `↓`/`↑` deltas on metrics. Keep these consistent with the components provided.
- **Logo:** the **double-loop crossover wave** — two indigo→teal gradient strokes that cross, evoking "outsmarting inflation". No background box. Paired with the `wobbl`+`io` wordmark where `io` is Electric Indigo. See `assets/wobblio-logo.svg` and the `WobblioLogo` component. A raster reference of the concept lives at `assets/wobblio-logo-mark.png`.

---

## Index / Manifest

**Global CSS**
- `styles.css` — the entry point consumers link (an `@import` manifest only).
- `base.css` — element resets + core utility classes (`.glass`, `.badge`, `.btn`, `.btn-icon`, `.aurora-bg`).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`.

**Components** (`components/<group>/` — React, `window.WobblioDesignSystem_6a8d64`)
- `core/` — `Button`, `Badge`, `Card`, `Tag`
- `forms/` — `Input` (with low-confidence `flagged` state), `Switch`, `Checkbox`
- `brand/` — `WobblioLogo`, `MerchantIcon`, `Avatar`
- `data/` — `MetricCard`, `ProgressBar`
- Each ships a `.jsx`, `.d.ts`, `.prompt.md`, and a shared `*.card.html` specimen per directory.

**UI Kit** (`ui_kits/web/`)
- `index.html` — interactive Home (marketing) ↔ Workspace (dashboard) recreation with theme + RLS-sandbox toggles. `Landing.jsx`, `Workspace.jsx`, `Icons.jsx`, `kit.css`, `README.md`.

**Template** (`templates/web-app/`)
- A self-contained, copy-ready Wobblio web-app starter (`index.html` + `ds-base.js` + kit modules). Offered to consuming projects in the template picker.

**Foundation cards** (`guidelines/`)
- 16 specimen cards across **Colors**, **Type**, **Spacing**, **Brand** — rendered in the Design System tab.

**Assets** (`assets/`)
- `wobblio-logo.svg`, `wobblio-logo-mark.png`, plus reference renders (`ref-landing-hero.png`, `ref-dashboard.png`, `ref-parse-verification.png`, `ref-upload-overlay.png`).

**Other**
- `SKILL.md` — makes this folder usable as a downloadable Agent Skill.

> Generated files (`_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`) are produced by the compiler — never edit them by hand.
