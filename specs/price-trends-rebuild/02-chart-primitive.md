# 02 — Chart primitive

**Layer:** webapp, rendering. **Fixes:** F1, F2 (the reported symptom).
**Contract change:** none. **Depends on:** 01.

## Problem

`line-chart.tsx` only ever strokes `segments(s.data)`, and gives a one-point run a `r="2.5"` circle:

```tsx
seg.length === 1
  ? <circle cx={x(seg[0][0])} cy={y(seg[0][1])} r="2.5" fill={s.color} … />
  : <polyline … />
```

Rendering the component directly with realistic props produces:

| Input | Actual SVG |
|---|---|
| 1 observed week, 1 series | `0 polylines`, `1 circle r=2.5` — a ~5px speck in a 760×320 chart |
| all purchases discounted | `0 polylines`, `0 circles`, 2 hollow diamonds |

Both read to the user as *"the chart is not drawing"*. A single observed week is the **normal** case
for one selected product, and promo-only history is common on NL receipts (BONUS lines).

## Required behaviour

### Markers on every observed week (F1)

Every non-null value gets a marker — not only orphan runs:

- `r = 3.5`, `fill` = series colour, `stroke = var(--bg-color)`, `stroke-width = 1.5` (a halo, so a
  marker stays legible where it crosses a gridline).
- `opacity 0.5` when the series is stale, matching the existing line treatment.
- Each marker carries a `<title>` with its week label and amount, alongside the promo `<title>` that
  already exists.

When a series' **entire visible data is a single point**, additionally render its value as a text
label beside the marker (`.chart-point-label`, `formatViewMoney`, offset right, clamped inside the
plot area). One purchase must be unmistakable, not a dot to hunt for.

### Two drawable tracks per series (F2)

Each series renders up to two tracks:

| Track | Source | Line | Marker |
|---|---|---|---|
| regular | `data` | solid (market) · dashed `5 4` (own) · `opacity 0.5` when stale | circle |
| promo | `discounts` | faint connector, `opacity ~0.55` | diamond (unchanged, §6.5.1) |

The promo track keeps its distinct diamond markers — §6.5.1 requires promo prices be *"rendered as
distinct markers rather than blended into the median"* — but now also gets its own connector, so a
promo-only series renders as a real, visible track instead of two floating diamonds.

Promo and regular are never merged into one line.

### Gap connectors (locked decision)

Between the end of one contiguous run and the start of the next, draw a connector with
`stroke-dasharray="2 5"` and `opacity ~0.45` in the series colour. Consecutive weeks stay solid.

Never a solid line across a gap — that asserts a price path nobody observed. The dotted style is what
makes the absence visible, which is only possible now that 01 puts empty weeks on the axis.

### Adaptive x-labels

The current rule `i % 2 === 0 || i === n - 1` emits 13 labels for a 26-week axis. Replace with
`step = max(1, ceil(n / 8))`, always including the last index.

### Accessibility

- Replace `aria-label="Price timeline"` with descriptive phrasing in the style
  `spend-over-time-chart.tsx` already uses — state the series count, the first and last values, and
  point at the data-table toggle. Example:
  *"Price paid per item, 2 series, from €2.49 on 5 Jan to €2.79 on 23 Feb. Toggle the data table for
  exact figures."*
- The `Chart | Table` toggle and `TrendTable` already satisfy the mandatory chart↔table pairing
  (§10.3, `specs/price-trends-gaps/04`) — do not change them.

### CSS

Add only the new classes to `src/styles/ds/workspace.css` beside the existing `.chart-*` block:
`.chart-point`, `.chart-point-label`, `.chart-gap`, `.chart-promo-link`. Reuse `.chart-wrap`,
`.chart-svg`, `.chart-grid`, `.chart-cross`, `.chart-ylabel`, `.chart-xlabel`, `.chart-tip*`,
`.trend-legend`, `.legend-*` as-is.

Use `var(--warning)`, **not** `var(--amber, …)` — `--amber` is never defined and silently fails to
theme.

### Explicitly not doing

Do **not** extract shared chart geometry (`x()`, `y()`, `gridVals`, `getIndexFromX`) into a common
module. Those are duplicated in exactly two webapp files today (`line-chart.tsx`,
`spend-over-time-chart.tsx`); `.claude/rules/code-quality-guard.md` Rule of Three says abstract on the
third occurrence. Recorded in the handoff gotchas as a future extraction.

## Files

- **Modified:** `Source/webapp/src/components/workspace/line-chart.tsx`,
  `Source/webapp/src/styles/ds/workspace.css`

## Done when

- A one-point series renders a visible haloed marker **and** its value as a label.
- A promo-only series renders a connected promo track with diamond markers, not two bare diamonds.
- A multi-week gap renders two solid runs joined by one dotted connector.
- Every observed week carries a marker.
- Dark and light themes both legible; `npm run lint` and `npm run test:unit` green.
