# 07.03 — Mobile live processing UX

**Today:** mobile is already ahead of the webapp — `DashboardBloc` polls the full invoice list
until terminal (2.5s/5s/hold-9s, ceiling ~5.5 min) and 16f push covers background delivery. What's
missing: the user stares at a static "Processing" chip for ~17s with no sense of movement, the
poll refetches the entire list + usage every tick, and the capture flow drops the user back with
no visible bridge to the in-flight receipt.

## Behaviour

1. **Stage-accurate processing chip.** Surface 07.01's `processingStage` on the dashboard invoice
   card and the invoice-detail screen: Received → "Reading your receipt…" → "Matching products &
   prices…" → "Finishing up…", with a subtle indeterminate animation. Same honesty rule as the
   webapp: stages, not fake percentages; copy says "usually about 20 seconds".
2. **Cheaper polling.** While rows are `PROCESSING`, poll `GET /invoices/status?ids=` (07.01)
   instead of `_invoices.list()`; only on a terminal transition refetch the full list + usage
   (credits charge at success). Keep the existing ramp/hold/ceiling and `_pollGen` supersession
   exactly as-is — this changes *what* each tick fetches, not the loop's shape. Tighten the hold
   interval from 9s to 5s: with the cheap endpoint, a faster tick is affordable and cuts up to 9s
   of pure staleness off perceived completion.
3. **Capture → dashboard continuity.** After `CaptureSuccess`, the return-to-dashboard already
   triggers a refresh; ensure the just-created invoice id is part of the polled set immediately
   (don't wait for it to appear in a full list fetch) so the stage chip is live within ~2s of
   confirm.
4. **Terminal feedback in-app.** On transition to PARSED/NEEDS_REVIEW while the app is foregrounded,
   show the design-system snackbar/banner ("Receipt ready — tap to review") deep-linking to the
   invoice detail — polling is the trigger; do NOT build FCM foreground-message handling (16f SNS
   platform wiring is manual and has zero registered devices today; background push remains 16f's
   scope).

## Implementation notes (flutter-architecture-guard)

- New port method on `IInvoiceRepository` (or a lean `IInvoiceStatusRepository` if ISP argues for
  it — rule of three says extend the existing port first): `fetchStatuses(List<String> ids)`
  returning `id → (status, processingStage)`.
- `processingStage` joins `InvoiceSummary`/`InvoiceDetail` models; unknown/absent stage renders the
  generic "Processing…" (backend rollout must never break older clients — additive field only).
- All loop changes stay inside `DashboardBloc` (and `InvoiceDetailBloc` if it shows live state);
  widgets remain logic-free.
- Copy/UI must reuse existing design-system components (chip, snackbar) — no new bespoke widgets.

## Acceptance

- Bloc tests: status-endpoint ticks update stage without a full list fetch; terminal transition
  triggers exactly one full list+usage refetch and one snackbar event; supersession and ceiling
  behaviour unchanged (adapt existing dashboard_bloc tests).
- Widget test: processing card renders each stage label; unknown stage falls back gracefully.
- `flutter analyze` clean + widget tests green before commit (flutter-architecture-guard #5).
- Manual on dev emulator (fvm run, dev dart-defines): capture a receipt → stage chip moves through
  stages → card flips to PARSED with snackbar, no pull-to-refresh needed.
