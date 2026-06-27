# Sub-spec C — Compare-mode toggle (trends page)

## Why
Let the user choose the comparison basis: their own prices vs the local-market (crowd) prices.
Market is the Premium overlay; STANDARD users only ever see their own prices. The comparison
endpoint already returns both series, so this is a client-side view filter (no API change).

## Changes — `Source/webapp/src/app/(app)/reports/page.tsx` (+ small CSS)
- Add state `mode: 'own' | 'market'`, default `'own'`.
- Render a segmented control `[ My prices | Local market ]` (reuse `FilterSelect` or a small
  two-button toggle; match the filter-card styling). For STANDARD (`!isPremium`), the
  `Local market` option is locked/disabled and selecting it surfaces the existing
  `trends-upsell` Card; never set `mode='market'` for them.
- `buildChart`: filter series by mode — `own` emits only the `ownHistory`-derived series,
  `market` emits only the `comparison.lines`-derived series. (Both arrays are already fetched by
  `usePriceTrends`.) Keep the existing per-line unit label + `trend-unit-caveat` banner.
- Empty-state copy: when `mode='market'` and no market lines, keep the "needs 3 confirmed scans
  nearby" message; when `mode='own'` and no own lines, the "once you've scanned…" message.

## Notes
- Default `own` means free users get a working chart immediately; market is the upsell.
- The `mode` value is also consumed by Sub-spec D (search badge) — expose it where `ProductSearch`
  is rendered so it can be passed as a prop in D.

## Validation
- `cd Source/webapp && npx tsc --noEmit && npm run test:unit`
- Manual: toggle switches series; STANDARD can't reach market (upsell shows); PREMIUM/TESTER/ADMIN
  can switch freely.

## Done-when
Toggle works with correct premium gating; caveat preserved; gates green. Update `00-handoff.md`
(Status C = done, Next = D; note that `mode` is now available to pass into `ProductSearch`).
