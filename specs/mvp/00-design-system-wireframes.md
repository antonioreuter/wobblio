# 00 — Design System & Wireframes

**Epic 1 | Phase 0 | Blocks all client work**

## Overview

Shared design system and screen wireframes produced with **Google Stitch** (AI-driven screen generation), used as the visual brief for both Flutter (mobile) and Next.js (web) implementation. Must be completed before any client feature work begins.

**Stitch workflow (not Figma):** design tokens are defined once as a Stitch design system (`create_design_system` / `create_design_system_from_design_md`); individual screens are generated from descriptive text prompts (`generate_screen_from_text`) rather than drawn by hand. The generated screens serve as the authoritative visual specification — implementation matches them, not the other way around.

## Dependencies

None — this is the root dependency.

## Design System Tokens

**Personality:** calm, precise, financial-grade trust with consumer warmth. Numbers are the protagonist; UI recedes.

**Colors (Tailwind theme):**
- Light: background `#FFFFFF`, surface `#F8FAFC`, text `#0F172A`, muted `#64748B`
- Dark: background `#0B0F19`, surface `#111827`, text `#F1F5F9`, muted `#94A3B8`
- Brand accent: `#0D9488` (teal/emerald — savings/positive signal)
- Semantic: green `#16A34A` (under budget/saving), amber `#D97706` (85% alert/low confidence), red `#DC2626` (breach/failed parse)
- Rule: never encode meaning in color alone — always pair with icon or label

**Typography:**
- One sans family: Inter (or comparable)
- Tight tracking on numerals; **tabular-nums everywhere money appears**
- Scale: 30/24/20 headings, 16 body, 14 secondary, 12 captions
- Currency amounts right-aligned in all tables

**Spacing & Shape:**
- 4px base grid; card radius 12; button radius 8
- 1px hairline borders (light mode); elevation-by-surface-tone (dark mode)
- Iconography: Lucide-class minimalist line icons, 1.5px stroke

## Mobile Layout (Flutter)

- Bottom tab bar: Home, Lists, Insights, Profile
- **Center-docked floating Scan button** raised above bar — capture is the core action
- Home: top bar with month selector + quota chip (`7/10 scans`), MTD stat card, budget bars (premium), recent invoices list
- Capture flow: full-screen camera → auto-crop preview → upload → return to Home with Processing row
- Review screen: vertically split (zoomable receipt photo top / parsed fields bottom); low-confidence fields highlighted amber; tap-to-fix bottom sheet; tag chip row; single `Confirm` button
- Lists: offline check-off support; `Optimize route` action (premium) with store-grouped sections
- Insights: category donut, budget status, weekly advisor card; hand-off CTA to web app
- Bill split: entry from any parsed restaurant bill; tap lines to assign to name chips; WhatsApp summary export

## Web Layout (Next.js)

- Sticky left nav (collapsible to icons at <1280px): Dashboard, Invoices, Reports, Shopping Lists, Budgets, Household, Settings, Admin (ADMIN only)
- Top bar: global search (invoices by tag/merchant/product), quota indicator, theme toggle, avatar menu
- Main content: max-width 1440, 12-column grid
- Collapsible right inspection drawer opens on row click (invoice detail, line items, photo) without losing list context
- Dashboard: stat-card row, spend-over-time area chart + category breakdown, recent invoices table
- Reports: 3-product/6-month comparison chart; merchant drill-down
- Invoices: dense table with saved filters, tag filter chips, `NEEDS_REVIEW` banner queue, bulk re-categorize
- Admin console: parameter editor (SSM), model-swap matrix, waitlist panel, DLQ panel, alias-curation queue, AI-spend dashboard

## Component Inventory (Stitch)

- Stat card (label, big number, delta chip)
- Data table (sticky header, right-aligned numerics, row drill chevron)
- Category chip
- Confidence badge (dot + label: confirmed / auto / low)
- Budget progress bar with 85% tick mark
- Price-history sparkline
- Store-comparison bar group
- List item row with checkbox
- Photo-capture frame overlay
- Review side-by-side panel
- Empty-state pattern (every data-driven view; always state what action fills them)
- Waitlist screen with position + "skip the line — go Premium" CTA
- Parse-review screen (mobile + web drawer version)
- Upgrade/checkout flow
- Admin DLQ + alias-curation panels
- Tag chip row + add-tag vocabulary picker

## Accessibility & Responsive Rules

- WCAG AA contrast in both themes
- Full keyboard navigation on tables and review drawer
- All charts accompanied by data-table toggles
- Web usable at 768px (tables collapse to card lists)

---

## Checklist

### Design Tokens & System
- [ ] Create Stitch design system: primary color `#0D9488`, Inter font, `ROUND_TWELVE`, light + dark modes, with full `designMd` capturing semantic colors and typographic rules
- [ ] Mirror tokens into Tailwind theme config (implementation artifact — must match the Stitch design system)
- [ ] Configure Inter with tabular-nums variant for currency display in Tailwind
- [ ] Document spacing scale (4px base grid) and border-radius tokens
- [ ] Define semantic color usage rules (color + icon/label pairs for accessibility)
- [ ] Create Lucide icon selection list for app use

### Mobile Wireframes (Flutter) — generate in Stitch with `deviceType: MOBILE`
- [ ] Home screen: month selector, quota chip, stat card, budget bars, recent invoices list
- [ ] Capture flow: camera view with edge-guide overlay, auto-crop preview, upload progress
- [ ] Review screen: split layout (photo top, fields bottom), low-confidence highlights, tag chip row, Confirm button
- [ ] Lists screen: active lists, list detail with offline check-off, route-optimize result view
- [ ] Insights screen: category donut, budget bars, weekly advisor card, web hand-off CTA
- [ ] Bill split screen: line-item assignment, fraction stepper, WhatsApp export sheet
- [ ] Profile/Settings screen: quota display, plan info, household membership
- [ ] Waitlist screen: position, skip-the-line CTA
- [ ] Push notification deep-link targets (invoice, review screen)

### Web Wireframes (Next.js) — generate in Stitch with `deviceType: DESKTOP`
- [ ] Frame: sticky left nav (collapsible), top bar with search/quota/theme/avatar, main content area, right inspection drawer
- [ ] Dashboard: stat-card row, spend-over-time area chart, category breakdown, recent invoices table
- [ ] Invoices page: dense table, saved filters, tag filter chips, NEEDS_REVIEW banner
- [ ] Review drawer: side-by-side photo + fields, tag chip row, corrections flow
- [ ] Reports page: comparison chart (3-product/6-month), merchant drill-down
- [ ] Shopping Lists page: list management, route-optimizer result
- [ ] Budgets page: budget definitions, progress bars, alert status
- [ ] Household page: member management, upload pool status
- [ ] Settings page: plan management, privacy controls (price contribution opt-out), data export/deletion
- [ ] Upgrade/checkout flow: pricing table (monthly vs annual), Stripe redirect
- [ ] Admin console: SSM param editor, model-swap matrix, waitlist panel, DLQ panel, alias-curation queue, AI-spend dashboard, KPI page

### Shared Component Specs
- [ ] Stat card component
- [ ] Data table component with sticky header and numeric alignment
- [ ] Confidence badge component (confirmed / auto / low)
- [ ] Budget progress bar with 85% threshold marker
- [ ] Empty-state pattern for all data-driven views
- [ ] Tag chip and vocabulary picker
- [ ] Category chip
