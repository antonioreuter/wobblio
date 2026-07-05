# Price-Trends Gaps — Handoff / Context Carry-Over

> Living doc. Update the **Status** + **What changed last** + **Next** sections at the END of
> each sub-spec so a fresh context window can resume without losing state.

## Goal

The price-trends report (`/reports` on the webapp, `GET /price-trends/comparison` on the backend)
was reviewed against the spec (§6.5.x, §10.3, `specs/mvp/11-*`, `specs/mvp/18-*/18e-reports.md`).
The core engine is **sound and shipped** — k≥3 quorum gate, quarantine exclusion, weekly dual
medians (regular vs discount), staleness decoration, RLS-scoped own history, pack-price fallback
with per-unit honesty. This series closes the remaining gaps between that engine and the
spec-promised experience, in independently shippable slices.

This is a **follow-up to `specs/price-trends-revamp/`** (which reverted the P2 size features and
added the compare-mode toggle). That series is complete; this one is orthogonal.

## Locked decisions

- **Own history stays 26 weeks for ALL tiers** (not the spec's free-tier 2-month limit). Own
  purchase history is the day-1 value hook and the strongest scan motivator — clipping it punishes
  exactly the users we want contributing to the index. This **amends the spec**; see
  `docs/amendments/2026-07-05-own-history-window-all-tiers.md`.
- **Currency: honesty only, no FX conversion.** Each view is filtered to a single currency
  (derived from the picker country) and rendered with the correct symbol. Cross-border FX
  harmonization stays deferred per §11 — the report shows the price you actually paid at the
  shelf, not a converted figure.
- **Out of scope (owner decision):**
  - Merchant drill-down view (§10.3 "pick a merchant → products bought there"). That belongs to a
    **different report**, not the price-trends report. Do not build it here.
  - Mobile 18e reports screen — tracked in the mobile epic. Sub-spec 02 & 03 change the
    `GET /price-trends/comparison` contract; 18e must consume the corrected contract when built.
    Note the dependency, do not implement mobile here.
  - Full FX harmonization for travellers.

## Findings (verified in code, 2026-07-05)

| # | Finding | Evidence | Sub-spec |
|---|---------|----------|----------|
| G1 | **6-month window unviewable.** Backend serves 26 weeks (`TREND_WINDOW_WEEKS=26`) but UI presets are 30d / this-month / 90d and custom range is hard-capped at 92 days. The §6.5.1 flagship "6-month chart" can never be displayed; the filter hint even claims "max range 6 months". | `reports/page.tsx:100` (`rangeDays > 92`), `inRange()` :472–480; `trend-data.ts` has no PRESETS export (presets live inline in `page.tsx`) | 01 |
| G2 | **Currency hardcoded to €, never filtered.** Neither SQL adapter returns or filters `currency`; the legend renders `€${now.toFixed(2)}` and `€/kg` unconditionally. Own-history medians can blend a pending-location foreign-currency receipt (country NULL) into any picker view. Violates the country-agnostic standing rule (user operates across 13 countries). | `PriceTrendQueryAdapter.ts:37–88`, `OwnPurchaseHistoryQueryAdapter.ts:34–93`, `reports/page.tsx:46–51,368` | 02 |
| G3 | **Personal price-history messaging missing** (§6.5.5, 11d): no "% change vs last scan", no "First purchase — we'll track this for you". The legend delta is first-vs-last of the *visible range* — a different metric, misleading in own mode. | `reports/page.tsx:349–377` | 03 |
| G4 | **No chart↔data-table toggle** — mandatory per webapp brief ("Every chart paired with a data-table toggle"; WCAG/keyboard access). The chart is hover-only SVG. | `line-chart.tsx`, `Source/webapp/CLAUDE.md` (Layout → Responsive floor) | 04 |
| G5 | **Cold-start motivator lacks the live count.** Spec copy: "2 stores tracked in your area — scan more receipts to unlock comparisons". Implementation uses static copy without the count, though `ProductSearchAdapter` already computes `marketMerchantCount`. | `reports/page.tsx:321–323` | 04 |
| G6 | **Spec/impl divergence — free-tier own-history window.** Resolved as "keep 26 weeks for all + amend spec" (see Locked decisions). | `priceTrendRoutes.ts`, spec §6.5.5 | amendment |
| M1 | `inRange` "This month" mixes UTC (`d.getUTCMonth()`) with local (`today.getMonth()`) → wrong inclusion near month boundaries. | `reports/page.tsx:475–476` | 01 |
| M2 | Stale comment: own-history adapter claims "lines without a normalized unit price are excluded" — the SQL actually falls back to pack price. | `OwnPurchaseHistoryQueryAdapter.ts:27` | 02 |

## Status

- [ ] 01 — six-month window (G1 + M1) — frontend only
- [ ] 02 — currency honesty (G2 + M2) — backend + web, contract change
- [ ] 03 — personal-history messaging (G3) — backend + web, additive contract change
- [ ] 04 — UX & accessibility: data-table toggle + live cold-start count (G4 + G5) — frontend + small response addition
- [ ] amendment — own-history window all tiers (G6) — docs

Order: 01 → 02 → 03 → 04. Each is independently shippable. 03 and 04 both touch the trends
response, so if shipped out of order, re-verify the response type in `use-price-trends.ts`.

## Contract-change ledger (for mobile 18e)

`GET /price-trends/comparison` response evolves across this series:
- **02** adds `currency` (top-level, ISO-4217) — the whole view is single-currency.
- **03** adds `lastPrice`, `previousPrice`, `lastPurchasedOn` to each `ownHistory[]` entry.
- **04** may add a per-product `regionMerchantCount` (or reuse the product-search signal — see 04).

Mobile 18e must consume these when built. Do not break the field names once shipped.

## Validation gates (per sub-spec)

- `cd Source/backend && npm run skill:hexagonal-architecture-validator` (exit 0) — 02, 03
- `cd Source/backend && npm run test:unit` — 02, 03
- `cd Source/backend && npm run validate:security` — 02, 03 (adapter SQL changes; **no DDL** expected)
- `cd Source/webapp && npm run test:unit` — all
- No migration in this series (all changes are read-only SQL + presentation).

## Gotchas

- `price_observation` has NO tenant/line linkage (de-identified, §6.5) — cannot retro-correct rows,
  cannot join back to an invoice. Currency filtering (02) works on the `currency` column that is
  already stored on each observation.
- Own history is **one blended line per product** (locked in the revamp); market is per-merchant.
- `rg`/`grep` are wrapped by a hook and may return garbled output via Bash — use `command grep`.
- There is **no country→currency reference table** in the DB today. Sub-spec 02 introduces a small
  curated constant map in `core/domain` (data-minimal, covers the operating countries).
- Env cheat-sheet: dev DB `wobblio_dev` (secret `shared/db/wobblio_dev`, user `wobblio_dev_app`),
  `DATABASE_URL` needs `?uselibpqcompat=true&sslmode=require`. `wobblio` (no `_dev`) = PROD, never
  touch. Deploy dev: `cd Source/infra && STAGE=dev npm run cdk:deploy:backend|cdk:deploy:web`.
