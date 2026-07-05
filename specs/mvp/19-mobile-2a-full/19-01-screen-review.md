# 19-01 — Mobile screen review checklist (prototype 2a conformance)

Companion to `19-00-handoff.md`. Tracks, per screen, how close the Flutter app is to
**prototype 2a "Spotlight Lean"** and what still needs a deep-body rebuild.

- **Prototype source of truth:** `Mobile UI design principles/Wobblio Mobile.dc.html`
  (screens tagged `data-screen="N"`). Render it over HTTP (`file://` is blocked in the browser
  tool) to see any screen: `cd "Mobile UI design principles" && python3 -m http.server 8765`,
  then open `http://localhost:8765/Wobblio Mobile.html` and click a row / element with the
  matching `data-screen`.
- **Verify on device:** `emulator-5554`, run cmd + dart-defines in
  `~/.claude/.../memory/project_mobile_dev_run_setup.md`.

## Legend
- ✅ **Conformed** — body rebuilt to 2a, reviewed on device.
- 🟠 **Chrome only** — has the 2a header/background (19d/19e) but the body is still the pre-2a
  layout; needs a deep rebuild + review.
- 🔴 **Needs rebuild (reviewed)** — divergence confirmed on device, specifics captured below.

## Global (done)
- **Aurora background app-wide** — `AuroraBackground` moved from `MaterialApp.home` to
  `MaterialApp.builder` (`lib/app.dart`), so it now shows behind **every** route, including pushed
  ones. This was the main reason pushed screens looked "completely different" (flat black). Every
  screen `Scaffold` must stay `backgroundColor: Colors.transparent`.

## Screens

| # | Screen | File (`lib/ui/…`) | Prototype | Status | To review / fix |
|---|--------|-------------------|-----------|--------|-----------------|
| 1 | Home / Dashboard | `dashboard/dashboard_screen.dart` | `data-screen="1"` | ✅ | Recent capped to 3, single-line ledger, tag chips removed. Done. |
| 2 | Invoice Detail | `invoice_detail/invoice_detail_screen.dart` | `data-screen="3"` | ✅ | Rebuilt + polished (full-width "View original", mono date, share-nodes icon, ×qty, glass feedback card). Residual (data-limited): no merchant branch sub-line; badge "READY" vs proto "PROCESSED"; single `Location` vs proto Country/Region; date has no time. |
| 3 | History / Receipts | `history/history_screen.dart` | `data-screen="4"` | ✅ | Rebuilt to 2a lean ledger + reviewed on `emulator-5554`. Single-line rows `● merchant  "30 Jun"[· label]  €amt` (short dates via `formatShortDate`, mono-tabular date+amount, merchant-color dot / warning-tone for review), month-grouped (JULY/JUNE overline w700), mono subtitle `N scanned · €X this month`, outlined search field. |
| 4 | Capture / Scan | `capture/capture_screen.dart` | `data-screen="2"` | ✅ | Rebuilt to 2a scan viewfinder + reviewed on device: full-bleed dark scene, top bar (back + "Scan receipt"), brand corner brackets, animated indigo→teal laser sweep, beige receipt-preview card (mono mock), "Align the receipt · tap to scan", white-ring brand-gradient shutter FAB → OS camera, Gallery + PDF as secondary buttons. **Decision:** stylized viewfinder (no live in-app camera feed — capture stays `image_picker`/OS camera; the prototype viewfinder is itself a static mock). |
| 5 | Review / Parse (Confirm) | `review/review_screen.dart` | 2a confirm/review | 🟠 | 2a inline-edit rows + "confirm each line" gate. Body still pre-2a. |
| 6 | Onboarding | `onboarding/onboarding_required_screen.dart` | 2a hero | 🟠 | 2a hero/onboarding layout. Body still pre-2a. |
| 7 | Budgets | `budgets/budgets_screen.dart` | `data-screen="5"` | 🟠 | Cap header (`€642 of €890 cap · June 2026`), category rows with health bars, "New budget". Needs diff. |
| 8 | Reports / Insights | `reports/reports_screen.dart` | `data-screen="6"` | ✅ (device pending) | Rebuilt to the 2a "Price report" personal-inflation view: header "Price report" + "`<region>` · last 90 days", "Your inflation vs region" fixed-series bars (You=teal, Region=amber, honest `—`/hint on nulls), reused dual-line `InflationSparkline`, "€X saved this year by switching" glass card, and an honest all-null building state. **Replaced** the 18e product-picker/trend chart entirely (bloc/port/adapter/`TrendLineChart` deleted; new lean `PriceReportBloc` over the existing `/me/insights/inflation`). **Deferred:** the prototype's per-product "Tracked items" list (needs an endpoint field over the matched basket) and the derived "X% cheaper than region" line. analyze 0, tests green; on-device review still to do. |
| 9 | Account | `account/account_screen.dart` | `data-screen="7"` | 🟠 | Profile header, plan/credits, settings list. Needs diff. |
| 10 | Shopping list | `shopping_list/shopping_list_screen.dart` | `data-screen="8"` | 🟠 | Add item, `N items · M stops`, split-route saving banner. Needs diff. |
| 11 | Notifications | `notifications/notifications_screen.dart` | `data-screen="9"` | 🟠 | "Mark all read", grouped alerts (over budget, price drop…). Needs diff. |
| 12 | Split bill | `split_bill/split_bill_screen.dart` | `data-screen="10"` | 🟠 | Premium gate, people avatars, per-line assignment, per-person totals. Needs diff. |
| 13 | Login / Auth | `auth/login_screen.dart` | landing/auth | 🟠 | Needs diff vs prototype landing/auth. |

> **Note:** statuses 🟠 mean "chrome landed in 19d/19e but the body has **not** been diffed against
> the prototype yet" — they still need a proper review, not just a rebuild assumption.

## Recommended order
1. ~~**History**~~ ✅ done (2026-07-03) — lean ledger rebuilt + reviewed on device.
2. ~~**Capture**~~ ✅ done (2026-07-03) — 2a scan viewfinder rebuilt + reviewed on device. Review → Onboarding next (19d deep bodies; review is the product's core flow).
3. Budgets, Reports, Account, Shopping, Notifications, Split (19e bodies), each diffed on device first.

## Per-screen review workflow (repeat for each)
1. Render the prototype screen (HTTP server above) and screenshot it for the target.
2. Screenshot the current app screen on `emulator-5554`.
3. List concrete divergences here, rebuild the body, keep every existing widget `Key`.
4. Gate: `fvm flutter analyze` (0) + `fvm flutter test` (green); verify on device; update this file.
