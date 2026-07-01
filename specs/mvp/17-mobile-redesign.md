# 17 — Mobile Design-System Redesign (Flutter)

**Mobile epic | Post-MVP | Depends on [16 — Mobile Capture & Review](./16-mobile-capture-and-review.md)**

> **This is the epic overview.** The epic is split into independently shippable slices —
> see **[17-00 — Mobile Redesign Handoff](./17-mobile-redesign/17-00-handoff.md)** (`17a`–`17e`) for the
> build order, dependency DAG, status tracker, and deferred-gap list. Implement one slice at a time.

## Overview

Epic 16 shipped the Flutter client's first cut on a bare-bones port of the Obsidian Aurora tokens
(flat colors, no glass, no shared component library). This epic elevates it to parity with the
**live, shipping web design system** (`Source/webapp/src/components/ds/` + `Source/webapp/src/styles/ds/`)
and the mobile-specific layout language explored in `Mobile UI design principles/` (an
externally-produced Claude-canvas prototype — HTML/CSS, not code to ship, but the source of truth
for mobile-specific layout decisions the webapp doesn't need: bottom-anchored capture CTA, receipt
scan viewfinder, tap-to-fix sheets sized for touch).

**This is a redesign, not new capability.** No new screens, no new backend calls, no new BLoC
states. Every slice below re-skins an existing, already-functional screen or adds a shared widget
library underneath it.

## Sources of truth (in priority order)

1. **`Source/webapp/src/components/ds/*.tsx` + `Source/webapp/src/styles/ds/tokens/*.css`** — canonical
   token values and component *behavior* (variants, states, tone maps). Colors/spacing/typography/effects
   tokens are byte-identical to the prototype's `_ds/*/tokens/*.css` — verified 2026-07-01. When a
   Flutter widget has a direct web analog (Button, Badge, Card, Tag, Input, Switch, Checkbox,
   MetricCard, ProgressBar, Avatar, MerchantIcon, WobblioLogo, AuroraBackground), **port the `.tsx`
   file's logic**, don't reverse-engineer from screenshots.
2. **`Mobile UI design principles/Wobblio Mobile.html`** (+ `.dc.html` source, `screenshots/`) — the
   mobile layout prototype. It contains **four explored directions** (`OPTION 1A/1B/1C` — three early
   stylistic takes on Onboarding/Home/Capture/Parse/History/Insights — and **`OPTION 2A`, the final
   11-screen synthesis**: Onboarding, Home (lean), Capture, Invoice Detail (read-only), History (lean
   ledger), Budgets, Reports, Account, Shopping List, Notifications, Split Bill, Processing). **Treat
   `OPTION 2A` as canonical** for mobile-specific layout; 1A/1B/1C are background rationale only.
   The prototype is a design exploration artifact, not a spec — where it conflicts with an existing
   backend contract or a hard invariant in the root `CLAUDE.md`, the invariant wins (analyze case by
   case, don't silently follow the mockup). Flag conflicts in the relevant slice file when found.
3. **This epic's sub-specs** — the implementation-ready translation of the above two for Flutter.

## Scope of this epic

Only the **5 screens that already exist** in `Source/mobile/` get re-skinned:
login (`ui/auth/login_screen.dart`), onboarding-required (`ui/onboarding/onboarding_required_screen.dart`),
capture (`ui/capture/capture_screen.dart`), dashboard (`ui/dashboard/dashboard_screen.dart`), review
(`ui/review/review_screen.dart`) — plus the shared theme (`ui/theme/app_theme.dart`) and root
(`app.dart`).

**Out of scope (tracked as follow-on epics, not built here):** the 6 net-new `OPTION 2A` screens
with no existing Flutter counterpart — Invoice Detail (read-only), History, Budgets, Reports,
Account, Shopping List, Notifications, Split Bill. Bottom-tab navigation (`app_shell.dart` is
currently a 12-line passthrough to `DashboardScreen` — there's nothing to re-skin there yet) lands
whenever the first of those new screens does, since a nav bar only makes sense once there's more
than one destination.

## Dependencies

- [16 — Mobile Capture & Review](./16-mobile-capture-and-review.md) (the 5 screens this epic re-skins)
- `Source/webapp/src/components/ds/` and `Source/webapp/src/styles/ds/tokens/` (canonical token/behavior source)

## Checklist

- [x] Flutter design-system foundation: tokens (color/spacing/typography/effects), `GlassContainer`,
      `WobblioButton`, `WobblioBadge`, `WobblioTag`, `WobblioInput`, `WobblioSwitch`, `WobblioCheckbox`,
      `MetricCard`, `ProgressBar`, `Avatar`, `MerchantIcon`, `WobblioLogo`, `AuroraBackground`
- [x] Outfit + Inter loaded via `google_fonts`; tabular-nums money styling
- [ ] Login / onboarding-required screens re-skinned to the Onboarding splash layout
- [ ] Capture screen re-skinned (viewfinder chrome, shutter button, glass overlays)
- [ ] Dashboard re-skinned to the Home (lean) layout (hero spend card, inflation card, recent list)
- [ ] Review screen re-skinned (tap-to-fix inputs/sheets using the new component library)
- [ ] `fvm flutter analyze` clean + `fvm flutter test` green after every slice
- [ ] No `core/` file imports `infrastructure/` or a concrete package (unchanged boundary)
