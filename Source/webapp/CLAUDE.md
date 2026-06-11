# Wobblio Webapp

Next.js + Tailwind web client: marketing landing, authenticated app (dashboard, invoices, reports, lists, budgets, household, settings), and the `/admin/*` console. Read the root `CLAUDE.md` first — invariants there apply here.

**Status:** scaffolding stage. Use this file as the convention reference as code lands.

## Personality (do not drift from this)

Calm, precise, financial-grade trust with consumer warmth — closer to a well-made banking app than a gamified coupon app. **Numbers are the protagonist; the UI recedes.** Marketing copy and product UX both serve that line.

Spec source: `docs/wobblio_v2.4_specification_final.md` §10 and §13.2; phase 0 wireframes in `specs/mvp/00-design-system-wireframes.md` are the binding brief.

## Design tokens (Tailwind theme)

| Token | Light | Dark |
|---|---|---|
| background | `#FFFFFF` | `#0B0F19` |
| surface | `#F8FAFC` | `#111827` |
| text | `#0F172A` | `#F1F5F9` |
| muted | `#64748B` | `#94A3B8` |

| Semantic | Use |
|---|---|
| brand `#0D9488` (teal/emerald) | primary actions, savings deltas |
| green `#16A34A` | under budget, saving |
| amber `#D97706` | 85% alert, low confidence |
| red `#DC2626` | breach, failed parse |

**Rules:**

- Never encode meaning in color alone — always pair with icon or label (accessibility).
- Currency uses **tabular-nums** everywhere (`font-variant-numeric: tabular-nums`). This single rule does more for perceived quality in a finance app than any illustration.
- Currency amounts are **right-aligned** in tables.
- Typography: Inter (or comparable). Scale 30/24/20 headings, 16 body, 14 secondary, 12 captions.
- 4px base grid; card radius 12; button radius 8.
- Light mode: 1px hairline borders. Dark mode: elevation-by-surface-tone, no heavy shadows on `#0B0F19`.
- Icons: Lucide-class minimalist line, 1.5px stroke.
- Native `dark:` variant per Tailwind, not a runtime theme provider.

## Layout

- **Sticky left vertical nav**, collapsible to icons at `<1280px`: Dashboard · Invoices · Reports · Shopping Lists · Budgets · Household · Settings · Admin (rendered only for `ADMIN` role).
- **Top bar:** global search (invoices by tag/merchant/product), quota indicator, theme toggle, avatar menu.
- **Main content:** max-width 1440, 12-column grid.
- **Collapsible right inspection drawer** opens on row click anywhere — invoice detail, line items, original photo — **without losing list context**. This pattern is mandatory; do not push users to a new route for row inspection.
- **Responsive floor:** must remain usable at 768px (tables collapse to card lists). WCAG AA contrast in both themes. Full keyboard navigation on tables and the review drawer. Every chart paired with a data-table toggle.

## Key pages and patterns

- **Dashboard:** stat-card row (MTD spend, Δ vs last month, budget health, scans remaining); 2/3 spend-over-time area chart + 1/3 category breakdown; full-width recent invoices table.
- **Invoices:** dense table (date, merchant, category, items, total, status). Saved filters. Tag filter chips (§6.10.6). `NEEDS_REVIEW` rows surfaced in a banner queue. Review opens in the right drawer mirroring mobile side-by-side: photo top, parsed fields below, low-confidence amber, tap-to-fix, tag chip row, single `Confirm`.
- **Reports (premium showcase):** 3-product / 6-month comparison chart — product multi-select (max 3), region label, one line per merchant per product with weekly-median points, discount markers, confidence/staleness greying per §6.5.2. Merchant drill-down with personal-price-trend sparklines.
- **Admin (`/admin/*`):** middleware-gated 403 for non-`ADMIN`. SSM parameter editor (caps, thresholds, routing minimum). Model-swap matrix with confirmation (vision/auxiliary/embedder/insight). Waitlist panel (count, cap, release button). DLQ panel (inspect + replay). Alias-curation queue (provisional merchants/products with approve/merge/reject). AI-spend dashboard fed by `ai_spend_ledger`.
- **Landing page** (`specs/mvp/06-landing-page-marketing.md` + spec §13.2): sections in order — hero · trust strip · how-it-works · persona feature grid · price-engine showcase · pricing table (annual visually preselected) · FAQ · final CTA + footer. Emits funnel events into the KPI pipeline.

## Hard rules specific to the webapp

1. **Subscriptions are sold here only.** Stripe Checkout monthly + annual. The customer portal is Stripe's, not ours. No checkout UI on mobile, ever. (Spec §2.2.)
2. **Annual is the promoted default** ("2 months free") because the €0.25 fixed payment fee per monthly charge is 10% of revenue.
3. **Waitlist state drives the hero CTA.** When `max_free_users_cap` is reached, primary CTA swaps to `Join the priority waitlist` with live position framing and a Premium-skip link. (Spec §13.2 §1.)
4. **Honest data freshness everywhere.** Stale price cells render greyed with their age; empty states always state *what action fills them*; comparison-not-yet-available copy is "every scan makes it smarter," never hidden.
5. **Inspection drawer never destroys context.** Row clicks open the drawer; back closes it; query state survives.
6. **Admin is middleware-gated.** Server-side role check; do not rely on client-side hiding alone.
7. **Receipt photos in review/inspection are zoomable, not embedded raw.** Use a tiled/zoom viewer.
8. **Capture/upload (when added):** strip EXIF, compress to ≤1MB JPEG, then PUT to the presigned URL. The presigned URL expires in ≤300s. (Spec §6.6, `.claude/rules/serverless-iac-architect.md`.)

## Component inventory (Stitch → React)

Build these as reusable components, not page-specific snowflakes: stat card · data table (sticky header, right-aligned numerics, row drill chevron) · category chip · confidence badge (dot + label: confirmed/auto/low) · budget progress bar with 85% tick · price-history sparkline · store-comparison bar group · list item with checkbox · photo-capture overlay (for the future PWA capture path) · review side-by-side panel · empty-state pattern.

## Testing

- Unit: Vitest, component-level, mock the API layer.
- E2E: Playwright per `.claude/rules/e2e-testing-coordinator.md` — `data-testid` selectors, polling loops with realistic backoff (never static sleeps), unique seeded tenant per run, mock backend or LocalStack-deployed backend.

## Commands (intended — populate as scripts land)

```
npm run dev               # next dev
npm run build             # next build
npm run lint              # eslint + typecheck
npm run test:unit         # Vitest
npm run test:e2e          # Playwright
```

## DoD checklist for any webapp change

- [ ] Dark mode parity verified (Tailwind `dark:` variants, not runtime CSS swaps)
- [ ] Tabular-nums on every monetary number; right-aligned in tables
- [ ] Responsive down to 768px (tables collapse to cards)
- [ ] WCAG AA contrast both themes; keyboard nav works on the affected surface
- [ ] If the change touches data: empty/loading/stale states all designed; freshness honesty preserved
- [ ] If the change touches admin: middleware role-gate in place
- [ ] If the change touches capture/upload: EXIF stripped, ≤1MB, presigned URL TTL ≤300s
