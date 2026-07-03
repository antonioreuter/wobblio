# 18 — Mobile Navigation & Net-New Screens (Flutter)

**Mobile epic | Post-MVP | Depends on [17 — Mobile Design-System Redesign](./17-mobile-redesign.md)**

> **This is the epic overview.** The epic is split into independently shippable slices — see
> **[18-00 — Handoff](./18-mobile-navigation-and-lists/18-00-handoff.md)** (`18a`–`18h`) for the build
> order, dependency DAG, status tracker, and deferred-gap list. Implement one slice at a time.

## Overview

Epic 17 ported the Obsidian Aurora design system into Flutter and re-skinned the app's 5 existing
screens (Login, Onboarding-required, Capture, Dashboard, Review). Its own charter explicitly excluded
new screens, new backend calls, and new BLoC state — and its living tracker named exactly what it
deferred: *"a future epic alongside the 6 net-new `OPTION 2A` screens: Invoice Detail, History,
Budgets, Reports, Account, Shopping List, Notifications, Split Bill."*

This epic is that follow-on. It gives the mobile app a real navigation shell (until now,
`app_shell.dart` has been a 12-line passthrough straight to Dashboard — there was nothing else to
navigate to) and starts building out the `OPTION 2A` screens one full-stack vertical slice at a time:
new ports, adapters, BLoCs, and UI wired to backend APIs that already exist and ship on web
(households, budgets, shopping lists + optimizer, splitting, notifications).

## Sources of truth (in priority order)

1. **`Mobile UI design principles/Wobblio Mobile.dc.html`** (+ `screenshots/`) — the mobile layout
   prototype. Contains four explored directions (`OPTION 1A/1B/1C` — early stylistic takes, background
   rationale only) and **`OPTION 2A`**, the 11-screen synthesis already treated as canonical by epic
   17: Onboarding, Home (lean), Capture, Invoice Detail (read-only), History (lean ledger), Budgets,
   Reports, Account, Shopping List, Notifications, Split Bill, Processing overlay. Verified against
   the live `claude.ai/design` project (`b671b48f-3f60-4d37-9b6c-d9e79b6e2ea0`) on 2026-07-02 — no
   drift from the local export. It's a design exploration artifact, not a spec — where it conflicts
   with an existing backend contract or a hard invariant in the root `CLAUDE.md`, the invariant wins.
   Flag conflicts in the relevant slice file when found (epic 17's slices set this precedent — e.g.
   17d dropped a notification-bell affordance that had no reachable destination in scope).
2. **The existing backend API surface** (`Source/backend/src/handlers/api-handler/`) — unlike epic 17,
   this epic *is* allowed to add mobile-side ports/adapters/BLoC state, and — if a slice genuinely
   needs it — small additive backend changes (e.g. list pagination). Prefer wiring to what already
   exists (`GET /invoices`, `listRoutes.ts`, `splitRoutes.ts`, `budgetRoutes.ts`,
   `notificationRoutes.ts`) over inventing new endpoints.
3. **This epic's sub-specs** — the implementation-ready translation of the above two for Flutter.
4. **`Source/mobile/lib/ui/design_system/`** (built in 17a) — the component library every new screen
   should build from (`GlassContainer`, `WobblioButton`, `WobblioBadge`, `WobblioTag`, `WobblioInput`,
   `MerchantIcon`, `Avatar`, `MetricCard`, `ProgressBar`, …).

## Scope of this epic (so far)

**In scope now (`18a`–`18c`):**
- **Bottom-tab navigation shell** — replaces the passthrough `app_shell.dart`. `OPTION 2A`'s bottom
  nav has 5 slots (Dashboard · Receipts · FAB-Capture · Shopping · Reports); this epic ships 4 —
  **Reports is omitted** until its own screen exists, following epic 17's "don't render a dead
  affordance" precedent.
- **History** — a full receipts list (search + month grouping) reusing the same `GET /invoices` call
  Dashboard already makes.
- **Invoice Detail** — read-only single-invoice view (photo, line items, feedback, share, delete).
  **Split bill is omitted** here too — no `hasSplit` field exists on the backend contract yet, and
  building that affordance correctly is Split Bill screen work (`18h`, deferred).
- **Shopping List** — a **per-user** list (see `18c` — this corrects an initial assumption from the
  design-folder read that lists were household-scoped; they are not), with a Premium-gated
  split-route optimizer banner and graceful degradation for STANDARD users.

**Deferred (tracked in `18-00`, not built here):** Budgets (`18d`), Reports (`18e`), Account (`18f`),
Notifications (`18g`), Split Bill (`18h`).

## Dependencies

- [17 — Mobile Design-System Redesign](./17-mobile-redesign.md) (design-system widgets, tokens, and
  the Dashboard screen this epic wraps into the new shell)
- Existing backend routes: `GET /invoices`, `GET/DELETE /invoices/{id}`, `POST /invoices/{id}/share`,
  all `/lists...` routes (`listRoutes.ts`), `POST /lists/{id}/optimize`

## Checklist

- [x] `18a` — Bottom-tab shell (`AppShell` rewrite, `IndexedStack` + `BottomNavigationBar`)
- [x] `18b` — History screen + Invoice Detail screen
- [x] `18c` — Shopping List screen
- [x] `fvm flutter analyze` clean + `fvm flutter test` green after every slice (except the
      pre-existing, unrelated `smoke_test.dart` compile issue — see `18-00`)
- [x] No `lib/core/` file imports `lib/infrastructure/` or a concrete package (unchanged boundary)
