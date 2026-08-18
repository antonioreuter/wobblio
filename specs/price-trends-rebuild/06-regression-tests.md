# 06 — Regression tests

**Layer:** webapp + backend. **Fixes:** F10, B4, B5. **Depends on:** 01–05.

## Problem

The price-trends report has almost no test surface, which is precisely why F1–F9 shipped across four
epics:

- `reports/page.tsx` — 751 lines, **zero tests**.
- `line-chart.tsx` — **zero tests**; no `line-chart.test.tsx` exists.
- Reports page — **zero Playwright E2E**. The six existing specs cover auth, logout, zombie session,
  onboarding, household and bill-split only.
- `PriceTrendService.test.ts` fixtures are **stale and type-invalid** (B4): `line()` omits the
  required `size`/`ambiguous`; `ownLine()` still carries a `unit` field removed by fix 09. Silent
  because `tsconfig.json` excludes `**/*.test.ts` and Vitest does not typecheck.
- `OwnPurchaseHistory.local.test.ts` never seeds `pack_quantity`/`base_unit`/`size_source` (B5), so
  the entire size-chip path — including B1's mixed-row bug — is untested at every tier.

## Webapp tests

Conventions to follow (already established): `@testing-library/react` + `fireEvent` (not
`userEvent`), jsdom via `vitest.config.ts`, chart components take data as **props** so no fetch
mocking is needed, `vi.stubGlobal('fetch', vi.fn())` where a component does fetch, and
`vi.mock('@/components/ds', …)` to avoid pulling the barrel.

### `trend-chart-model.test.ts` (new)

- Axis is continuous: two observations 12 weeks apart yield 13 axis weeks, 11 of them `null`.
- Single observed week → one series, one label, one non-null value.
- Promo-only series survives and reports `hasRegular === false`, `hasPromo === true`.
- Out-of-range product appears in `hidden` with `OUT_OF_RANGE`; a product with no points at all
  reports `NO_DATA`.
- Colour stability: the same product yields the same colour in own and market mode.
- `sizeWarning` true only when ≥2 visible series disagree on size or a size is unknown.
- `resolveWeekRange` / `weekInRange`: UTC Monday snapping, month preset fully UTC, overlap semantics
  (a week whose Monday precedes the range start but which holds in-range days is included), invalid
  custom range falls back to 90d.

### `line-chart.test.tsx` (new)

Assert on the rendered SVG via `container.querySelectorAll`:

- Single point → a marker (`.chart-point`) **and** a value label (`.chart-point-label`); this is the
  direct regression test for the reported bug.
- Promo-only series → promo markers **and** a promo connector; not zero drawn elements.
- One-week gap → two solid runs plus exactly one `.chart-gap` connector.
- A marker exists for every non-null week.
- Axis labels render the view currency (`£` when `currency="GBP"`, never `€`) — mirrors the existing
  `trend-table.test.tsx` assertion.
- Hover shows the tooltip — stub `getBoundingClientRect` per `spend-over-time-chart.test.tsx`
  (jsdom returns zeros). `onMouseMove` needs no `PointerEvent` polyfill.

### `reports/page.test.tsx` (new)

Mock `next-auth/react`'s `useSession` and `fetch`.

- Region-missing → `trends-region-required` state; its button opens `trend-region-editor`.
- Product outside the date range → `trend-chip-note` reads "outside this date range".
- Auto mode fallback → `trends-auto-notice` appears and the mode flips.
- `trends-view-chart` ↔ `trends-view-table` swaps the chart for `trends-table`.
- STANDARD role → `trends-upsell` shown and `trends-mode-market` disabled.

### `src/test/e2e/price-trends.spec.ts` (new, Playwright)

Per `.claude/rules/e2e-testing-coordinator.md`: unique seeded tenant per run via
`src/test/e2e/helpers/db.ts`, `data-testid` selectors, polling loops with backoff — never static
sleeps.

Scenario: seed a tenant with **one** invoice line for one product in a known region, log in, open
`/reports`, search and add the product, and assert the chart draws a visible marker with a value
label and that the table twin shows the same single week. This is the end-to-end guard for the
reported bug.

## Backend tests

### `PriceTrendService.test.ts`

- **Fix the stale fixtures first (B4):** add `size: { sizeText: null, sizeSource: null }` and
  `ambiguous: false` to `line()`; drop `unit` and add `size` to `ownLine()`. Consider whether the
  test tsconfig exclusion is worth revisiting — out of scope here, but note it in the handoff.
- Own-history staleness: `lastPurchasedOn` 72 days ago → `stale: true, staleDays: 72`; 3 days ago →
  `stale: false, staleDays: 3`.
- `priorPurchaseExists` passes through untouched.
- Coverage gate is **lines 99 / functions 100 / branches 99** over `src/core/**` — every new branch
  needs a case.

### `OwnPurchaseHistory.local.test.ts`

Extend `insertLine()` to accept `packQuantity`, `baseUnit`, `sizeSource`, then add:

- **B1 regression:** two lines for one product on the **same** `transaction_date`, one
  `(2, 'L')` and one `(500, 'KG')`. Assert `sizeText` is a coherent single-row pair — never a
  mixed "500 L". Run the assertion against the deterministic `line_id DESC` tiebreak.
- `size_source` precedence: a `USER` line among `RECEIPT` lines yields `sizeSource: 'USER'`.
- **B2:** two lines of the same product on **one** invoice → `purchaseCount === 1`.
- **B2:** a purchase older than the 26-week window → `priorPurchaseExists === true`, while the
  in-window `purchaseCount` stays 1 and the legend therefore must not say "first purchase";
  and the negative case → `false`.

Reuse the file's existing RLS harness (`CREATE ROLE … NOLOGIN`, `SET LOCAL ROLE`,
`set_config('app.current_tenant_id', …, true)`, always `ROLLBACK`) and its `afterAll` cleanup order.

## Appendix — fix 10 behaviour touched here (D2)

Fix 10 has no spec file. For the record, this series preserves it unchanged:

- Silent `product_link` (tenant-scoped, RLS, one canonical row per unordered pair, `product_a_id <
  product_b_id`) recorded implicitly from suggestion-chip taps.
- `GET /price-trends/suggestions` counterpart chips — `COUNTERPART_EMBEDDING_MIN = 0.75`,
  `COUNTERPART_TRGM_MIN = 0.35`, `COUNTERPART_MAX = 5`; accepted links always surface first.
- The `MarketDiagnostic` / `OwnDiagnostic` unions driving the empty-chart notes.
- The inline "same size?" confirm affordance, which is the sole override making a linked pair
  crown/optimizer eligible under the 09/05 comparability rule.
- The auto mode/range fallbacks (`resolveAutoMode`, `widenRangeIfHidden`) — sub-spec 01 re-bases them
  on the new range helper without changing their decisions.

## Done when

All gates in `00-handoff.md` are green and the seven manual checks in the plan's verification
section pass on local or dev.
