# 03 — Region gating and empty states

**Layer:** webapp. **Fixes:** F4. **Contract change:** none.

## Problem

`use-price-trends.ts:106` silently bails when the region is unresolved:

```ts
if (!enabled || productIds.length === 0 || !countryCode || !regionCode) {
  setComparison(null)
  return
}
```

If the caller's profile has no `regionCode` — never onboarded with one, or the profile fetch failed —
**no request is ever made**. `comparison` stays `null`, and `TrendChartBody` renders:

> "No prices yet — once you've scanned one of these items in this region it'll chart here. Every scan
> makes it smarter."

That is false. The user may have plenty of scans; the report simply has no region to query. Nothing
in the UI says a region is required: `RegionPicker` collapses to the country name plus a "Modify"
link. `TrendSuggestions` (`trend-suggestions.tsx:40`) goes silent for the same reason, so the
counterpart chips vanish with no explanation.

This violates webapp hard rule #4 — *empty states always state what action fills them*.

## Required behaviour

### A distinct "region required" state

`reports/page.tsx` derives `regionMissing = !country || !region` and renders it **ahead of** the
data-driven empty states, with `data-testid="trends-region-required"`:

> **Choose a region to see prices** — price trends are served per region. Pick yours to chart your
> purchases and compare local stores.

with a primary button that opens the region picker.

This state takes precedence over "no products selected" only when products *are* selected — if
nothing is selected, keep the existing "Add a product above…" copy, since picking a region first
would be busywork.

### Controlled `RegionPicker`

`region-picker.tsx` gains optional controlled props, defaulting to today's uncontrolled behaviour:

```ts
open?: boolean
onOpenChange?: (open: boolean) => void
```

The page holds `pickerOpen` state so the button above can open it. Existing testids
(`trend-region-label`, `trend-region-modify`, `trend-region-editor`, `trend-region-country`,
`trend-region-region`) are unchanged.

The picker's Apply button is already disabled until a region is chosen — keep that.

### Suggestions explain themselves

`TrendSuggestions` currently returns `null` when the region is missing. It keeps returning `null`
(the page-level state above now carries the explanation), but the guard gains a comment so the next
reader doesn't reintroduce a silent branch. No duplicate messaging.

### Copy that must not change

`specs/price-trends-gaps/04-ux-accessibility.md` mandates these strings verbatim — preserve them
exactly, they are only *reordered* behind the new region gate:

- `{N} store(s) tracked in your area — scan more receipts to unlock comparisons.`
- `No local-store prices yet — every scan makes it smarter.`
- `No prices yet — once you've scanned one of these items in this region it'll chart here. Every scan
  makes it smarter.`
- `No price points in this date range — widen the range to see more.`

## Files

- **Modified:** `Source/webapp/src/app/(app)/reports/page.tsx`,
  `src/components/workspace/region-picker.tsx`, `src/components/workspace/trend-suggestions.tsx`

## Done when

- With no profile region, selecting a product shows the region-required state, and its button opens
  the picker.
- Applying a region immediately issues the request and charts.
- No existing mandated empty-state string was altered.
- `npm run lint` and `npm run test:unit` green.
