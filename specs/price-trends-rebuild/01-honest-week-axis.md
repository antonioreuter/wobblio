# 01 — Honest week axis

**Layer:** webapp, pure logic. **Fixes:** F3, F7, F8, F9, F10, and the model half of F2.
**Contract change:** none.

## Problem

`buildChart()` in `src/app/(app)/reports/page.tsx:662-751` builds the x-axis as the **union of weeks
that have data**, filtered by `inRange()`:

```ts
const weekSet = new Set<string>()
sourceLines.forEach((l) => l.points.forEach((pt) => weekSet.add(pt.weekStart)))
const weeks = [...weekSet].sort().filter((w) => inRange(...))
```

Weeks with no observation therefore do not exist on the axis. Consequences:

1. A purchase in February and one in July render **adjacent**, joined by a straight line. The slope
   of a *price-trend* chart is meaningless.
2. For a single series, `data` can never contain `null` — so `segments()` in `line-chart.tsx` and its
   comment ("line breaks on missing weeks instead of interpolating") are dead code in the default
   (own) mode.
3. Time compression is invisible: nothing tells the user the two points are five months apart.

Plus three bugs in the surrounding logic: range maths (F8), no explanation when a product is hidden
by the range (F7), and colour instability across the mode toggle (F9). All of it sits untested inside
a 751-line client component (F10).

## Required behaviour

### Range resolution — replaces `inRange` / `daysBack`

New pure helpers in `trend-data.ts`:

```ts
export interface WeekRange { startWeek: string; endWeek: string } // ISO Mondays, UTC

export function mondayOf(d: Date): string
export function resolveWeekRange(
  preset: TrendPreset, from: string, to: string, rangeInvalid: boolean, today?: Date,
): WeekRange
export function weekInRange(weekStart: string, range: WeekRange): boolean
```

- Everything is normalised to the **UTC Monday** of the week. `daysBack()` currently carries the
  current time-of-day, which is compared against UTC-midnight week starts — that off-by-a-partial-day
  is what `mondayOf` removes.
- A week is included when **it overlaps the range**, not when its Monday falls inside it. Today a
  week starting on day 92 is dropped whole under "Last 3 months" even though it holds data from
  day 88. `resolveWeekRange` therefore snaps `startWeek` back to the Monday of the week containing
  the range start.
- Preset mapping (unchanged windows): `30d` → 30 days back · `90d` → 90 · `6m` → 183 ·
  `month` → the current calendar month, **fully UTC** (the gaps/01 fix) · `custom` → `from`..`to`
  when valid, otherwise fall through to `90d` (mirrors today's `rangeInvalid` behaviour).
- `endWeek` is the Monday of the week containing the range end (today, or `to` for a custom range).

`inRange` and `daysBack` are deleted; `widenRangeIfHidden` and `resolveAutoMode` move onto
`weekInRange`. `trend-data.test.ts` is updated in the same change.

### Continuous axis

```ts
export function buildWeekAxis(startWeek: string, endWeek: string): string[]
```

Returns **every** Monday from `startWeek` to `endWeek` inclusive, in ascending order, with no holes.

The axis actually rendered spans the **first→last observed week across the visible series, clamped to
the resolved range** — not the whole range. Locked decision: this preserves true relative spacing
between observations without leaving a wall of dead space when the user picks "Last 6 months" and has
three recent purchases. Weeks *between* the first and last observation are always present, which is
the point: that is where the gaps become visible.

When no series has any point in range, the axis is empty and the caller renders an empty state.

### New module: `trend-chart-model.ts`

Move out of `reports/page.tsx` (F10) so all of it is unit-testable:

- `interface ChartSeries` (unchanged shape, plus `stale`/`staleDays` now meaningful for own series
  once 04 lands)
- `buildTrendChart(input): TrendChartModel` — replaces `buildChart`
- `sizeChip(size: SeriesSize): string`
- `diagnosticNote(...)`, `marketDiagnosticNote(...)`
- `buildSizePrompts(...)`, `pairKey(a, b)`

```ts
export type HiddenReason = 'OUT_OF_RANGE' | 'NO_DATA'

export interface TrendChartModel {
  series: ChartSeries[]
  labels: string[]          // one per axis week, e.g. "5 Jan"
  weeks: string[]           // the ISO Monday axis itself
  sizeWarning: boolean
  hidden: Array<{ productId: string; reason: HiddenReason }>
}
```

`hidden` (F7) distinguishes *"this product has points, but none in your date range"*
(`OUT_OF_RANGE`) from *"this product has no points at all in the active mode"* (`NO_DATA`). Sub-spec
05 renders it on the product chip; the backend `ProductDiagnostic` continues to explain the
server-side reasons.

### Promo-only series (model half of F2)

A series whose regular `data` is entirely `null` but whose `discounts` hold values must survive the
visibility filter — it already does — **and** the model must mark it so the renderer can draw a
promo track rather than nothing:

```ts
hasRegular: boolean   // any non-null in data
hasPromo: boolean     // any non-null in discounts
```

Sub-spec 02 consumes these.

### Stable colours (F9)

Colour is keyed to the product's position in `selected`, never to the per-mode series index:

- own mode → `seriesColor(selectedIndex * 3)`
- market mode → `seriesColor(selectedIndex * 3 + merchantOrdinalWithinProduct)`

With `MAX_PRODUCTS = 3` and the 9-colour `SERIES_COLORS` palette this partitions exactly, and a
product's own line shares its hue with that product's first market line. Reuse `seriesColor()` from
`trend-data.ts` — do not introduce a second palette.

A merchant ordinal beyond 2 wraps within the palette; with three products at three-plus stores the
legend name remains the primary discriminator, as today.

## Files

- **New:** `Source/webapp/src/components/workspace/trend-chart-model.ts`
- **Modified:** `src/components/workspace/trend-data.ts` (range helpers; delete `inRange`/`daysBack`),
  `trend-data.test.ts`, `src/components/workspace/index.ts` (exports),
  `src/app/(app)/reports/page.tsx` (large reduction — composition and state only)

## Done when

- `reports/page.tsx` contains no chart-building logic.
- Two purchases three months apart produce an axis containing every intervening week, with `null`
  data for each.
- A week holding data from day 88 is no longer dropped by the "Last 3 months" preset.
- Toggling My prices ↔ Local market does not change a product's colour.
- `npm run lint` and `npm run test:unit` green in `Source/webapp`.
