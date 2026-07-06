# 07.02 — Webapp live processing UX

**Problem today** (`workspace-provider.tsx` + `invoice-map.ts`): after an upload the webapp fires
exactly three list reloads at 2.5s/5s/9s and goes silent — but measured p50 is ~17.4s, p90 ~25s, so
**essentially every invoice finishes after the last poll** and sits on "Reading receipt…" until the
user manually refreshes. The copy claims "this usually takes a few seconds", which is false.

**Goal:** the invoice row walks through real stages and lands on its terminal state with zero user
action, everywhere the workspace provider feeds (invoices table, dashboard recent list, usage
counter, budgets).

## Behaviour

1. **Poll-until-terminal.** Replace the fixed `[2500, 5000, 9000]` timers with a loop mirroring the
   mobile `DashboardBloc` (2.5s → 5s → hold 5s), but polling the cheap `GET /invoices/status?ids=`
   endpoint from 07.01 with the currently-`PROCESSING` invoice ids — not the full list. Hard
   ceiling ~3 min (p90 is 25s; the ceiling only guards a stuck row). On ceiling, stop and show a
   quiet "still working — we'll keep at it" state; push/terminal flip will still land on the next
   natural list load.
2. **Terminal transition = full refresh.** When a polled id leaves `PROCESSING`: reload invoices +
   usage (credits were charged at success), and if the new status is PARSED/NEEDS_REVIEW also
   `refreshBudgets()` (upload-time budget alerts). Fire one toast: "Receipt ready — €23.45 at
   Jumbo" / "Needs a quick review" / failure copy from the existing `invoice-map.ts` maps.
3. **Stage-accurate row + toast.** While `PROCESSING`, render the 07.01 `processingStage` copy
   (Received → Reading your receipt… → Matching products & prices… → Finishing up…) in the status
   badge/tooltip and in the persistent processing toast. Add an indeterminate progress affordance
   consistent with the design system (no fake percentage bars — stages are honest, percentages
   would not be).
4. **Poll on load, not just after upload.** If the initial `GET /invoices` contains any
   `PROCESSING` row (e.g. user uploaded on mobile, then opened the webapp), start the same polling
   loop. This is what "active without refresh" means across devices.
5. **Honest copy.** `invoice-map.ts` PROCESSING description → "We're reading it now — this usually
   takes about 20 seconds." Revisit the number after 07.04/07.05 land.
6. **Supersession & cleanup.** A manual refresh or a new upload restarts the loop with the fresh
   id set (generation counter, exactly like `DashboardBloc._pollGen`); the loop dies on unmount;
   tab-hidden pauses polling (`document.visibilitychange`) and re-checks immediately on visible.

## Implementation notes

- All of this lives in `workspace-provider.tsx` (state) + `invoice-table.tsx` / status badge
  component (rendering) + `invoice-map.ts` (copy). No new provider.
- Add `processingStage` to the invoice mapping types (`invoice-data.ts`).
- `data-testid` on the stage badge and the ready-toast for E2E.

## Acceptance

- E2E (mock server, per-test tenant): seed a PROCESSING invoice whose mocked status endpoint walks
  READING → MATCHING → PARSED; assert the row badge text changes and the row flips to PARSED
  **without any reload/navigation**, and the usage counter updates. Polling assertions use the
  e2e-testing-coordinator backoff pattern.
- E2E: status endpoint returning the same PROCESSING answer past the ceiling → polling stops,
  "still working" state shown, no console errors.
- Unit (Vitest): provider poll loop — supersession by refresh, terminal-triggered
  loadInvoices/loadUsage/refreshBudgets, visibility pause.
- DoD: dark-mode parity on the new badge/toast states, WCAG AA, stage never encoded by color
  alone (pair with label), tabular-nums untouched.
