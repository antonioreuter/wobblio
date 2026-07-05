# 01 — Make the 6-month window viewable (G1 + M1)

## Problem

The backend serves a **26-week (6-month) trailing window** — `TREND_WINDOW_WEEKS = 26` in
`Source/backend/src/core/services/data-intelligence/PriceTrendService.ts:6`, passed to both the
market and own-history adapters. The webapp, however, can never display it:

- Date-range presets are only **30d / this-month / 90d (default) / custom**. The `Preset` union,
  the `PRESETS` list, and `MONTHS` are all defined in
  `Source/webapp/src/components/workspace/invoice-data.ts` (`Preset` :34, `MONTHS` :64, `PRESETS`
  :137) and are **shared with the invoices page** (`FilterDraft.preset`, `BLANK`). The reports page
  imports them and adds its own `inRange()` range math. The longest standing preset is 90 days.
- Custom range is **hard-capped at 92 days**: `rangeInvalid = ... rangeDays > 92`
  (`reports/page.tsx:100`) with hint copy "Range can't exceed 3 months."
- Yet the filter footer claims **"max range 6 months"** (`reports/page.tsx:222`) — the UI promises
  6 months and refuses anything past 3.

Net effect: the §6.5.1 flagship "3-product / 6-month comparison chart" — the premium showcase —
is literally undisplayable. Half the data the backend computes and ships is discarded client-side.

Secondary (**M1**): the "This month" preset compares UTC and local time —
`d.getUTCMonth() === today.getMonth()` (`reports/page.tsx:475–476`). Near a month boundary in a
non-UTC timezone the two disagree, so a week can be wrongly included or dropped.

## Required behaviour

1. **Add a "Last 6 months" preset.** Value `6m`, label "Last 6 months". Filters weeks to
   `weekStart >= today − 183 days`. This is the preset that reveals the full served window.
2. **Default stays `90d`.** Recommendation: keep the current default so the first paint is the
   familiar 3-month view; 6 months is one click away. (If the owner prefers 6m as default, it's a
   one-line change — but do not change it silently.)
3. **Raise the custom-range cap to 183 days.** `rangeInvalid` triggers on `rangeDays > 183`
   (or `< 0`). Update the invalid-range copy to "Range can't exceed 6 months."
4. **Fix the footer hint** so "max range 6 months" is now true (it already reads 6 months — it
   simply becomes accurate once the cap is raised).
5. **Fix M1:** make the month preset consistently UTC — compare `d.getUTCMonth()`/`getUTCFullYear()`
   against `now`'s UTC month/year (`new Date()` → `.getUTCMonth()`, `.getUTCFullYear()`). The week
   axis is built from `new Date(\`${w}T00:00:00Z\`)` (UTC), so all range math must be UTC to match.

### Shared-type fork — decide first
`Preset` / `PRESETS` are shared between reports and invoices. Adding `'6m'` to them adds a
"Last 6 months" option to the **invoices filter** too. Decide:
- **Preferred:** a reports-local preset. Reports only needs the extra option, invoices is a
  different domain (spend filtering). Define a reports-scoped `TrendPreset = Preset | '6m'` (or a
  small local `TREND_PRESETS`) so the invoices filter is untouched. Avoids widening a shared type
  for one caller.
- Alternative: add `'6m'` to the shared `Preset`/`PRESETS` and let invoices gain the option too —
  only if that's actually wanted there. Do not do this silently.

## Files to touch

- `Source/webapp/src/app/(app)/reports/page.tsx`
  - Use the reports-scoped preset (per the fork decision); render the "Last 6 months" option.
  - `rangeInvalid` cap `92 → 183` (`reports/page.tsx:100`); invalid copy → "…6 months".
  - `inRange()` (:472–480): add the `6m` branch (`d >= daysBack(183)`); fix the `month` branch to UTC
    (`today.getUTCMonth()` / `getUTCFullYear()`).
- `Source/webapp/src/components/workspace/invoice-data.ts` — only if the shared-type route is chosen
  (add `'6m'` to `Preset` + a `PRESETS` entry). Skip under the preferred reports-local approach.

**Frontend only. No backend, API, or DDL change** — the backend already serves 26 weeks.

## Tests

- `Source/webapp` unit test for `inRange` (or `buildChart` range filtering): a week 150 days old is
  **excluded** under `90d`, **included** under `6m`; the `month` branch includes only current-UTC-month
  weeks and is stable across a simulated month boundary.
- If `PRESETS` moves to `trend-data.ts`, keep the existing import site green.

## Definition of Done

- [ ] "Last 6 months" preset present; selecting it charts weeks up to ~183 days old.
- [ ] Custom range accepts up to 183 days; rejects beyond with "…6 months" copy.
- [ ] Footer "max range 6 months" hint is now truthful.
- [ ] `month` preset is UTC-consistent (M1 fixed).
- [ ] Webapp unit tests cover the range filtering; `npm run test:unit` green.
- [ ] Dark-mode + 768px parity unaffected (no new layout).

## Handoff update

On completion, tick `01` in `00-handoff.md` → Status and record the default-preset decision made.
