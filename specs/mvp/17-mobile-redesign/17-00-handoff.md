# 17-00 — Mobile Redesign Handoff (living tracker)

**Mobile epic | Parent: [17 — Mobile Design-System Redesign](../17-mobile-redesign.md)**

The redesign is split into independently shippable slices. This file is the **living tracker**:
update the status column as each slice lands. The parent `17-*.md` remains the epic
overview/requirements; the sub-specs below are implementation-ready slices in build order.

> **Workflow:** implement **one slice at a time**, update this tracker + the slice's checklist,
> then **clear context between slices**. Don't carry one slice's working set into the next.

## Slices

| Slice | Title | Status | Depends on |
|---|---|---|---|
| [17a](./17a-design-system-foundation.md) | Design-system foundation (tokens + shared widgets) | ✅ | — |
| [17b](./17b-onboarding-auth-reskin.md) | Onboarding & login re-skin | ⬜ | 17a |
| [17c](./17c-capture-reskin.md) | Capture re-skin | ⬜ | 17a |
| [17d](./17d-dashboard-reskin.md) | Dashboard (Home) re-skin | ⬜ | 17a |
| [17e](./17e-review-reskin.md) | Review re-skin | ⬜ | 17a |

Status legend: ⬜ not started · 🚧 in progress · ✅ done

**Dependency DAG:** `17a → {17b, 17c, 17d, 17e}`. `17b`–`17e` touch disjoint screens and can be
built in any order (or in parallel across sessions) once `17a` lands — no reason to serialize them
beyond normal one-slice-at-a-time discipline.

## Deferred / known gaps

- **17a built & verified (✅).** `lib/ui/design_system/`: `tokens.dart` (`AppColors`/`AppSpacing`/
  `AppTypography`, ported verbatim from `Source/webapp/src/styles/ds/tokens/*.css`), `GlassContainer`,
  `WobblioButton` (primary/outline/text × md/lg, `foregroundColor` override for one-off tints),
  `WobblioBadge`, `WobblioTag` (+ a `selected` state `Tag.tsx` has no analog for, added for 17d's tag
  filter), `WobblioInput` (`flagged` state for review-screen low-confidence lines), `WobblioSwitch`,
  `WobblioCheckbox`, `MetricCard`, `ProgressBar` (reduced-motion aware via
  `MediaQuery`/`platformDispatcher.accessibilityFeatures.disableAnimations`), `Avatar`, `MerchantIcon`
  (Lucide glyphs via the `lucide_icons` pub package, not hand-ported SVG paths; preserved `MerchantIcon.tsx`'s
  prefix-match semantics and Jumbo's dark-ink-on-amber glyph color), `WobblioLogo` (bezier
  `CustomPainter`, direct port of the SVG path control points), `AuroraBackground` (three blurred
  `ImageFiltered` blobs, `AnimationController`-driven drift, static under reduced-motion). `app_theme.dart`
  re-sourced from the token file (kept `AppColors`/`AppTheme.money` as backward-compatible re-exports so
  `17b`–`17e`'s not-yet-touched screens keep compiling); `AuroraBackground` mounted once in `app.dart`
  behind `AuthGate` inside a `Stack`. `fvm flutter analyze` → 0 issues, `fvm flutter test` → 49 green
  (no behavior changed, only chrome/theme). **Landmine for the next slice:** mounting the aurora in
  `app.dart` only makes it visible once each screen's `Scaffold` sets
  `backgroundColor: Colors.transparent` — that's part of `17b`–`17e`'s work, not done yet, so screens
  still render on a flat `AppColors.background` today.
- **Post-review fixes (2026-07-01):** a `/code-review` pass caught two real bugs in `17a`, both fixed —
  (1) `ProgressBar` had no `didUpdateWidget`, so `_target` froze at its `initState` value on rebuild
  with a new `value` prop; added the override so a live value (e.g. a budget bar) keeps animating.
  (2) `GlassContainer`'s `BoxShadow` was nested inside its `ClipRRect`, which clipped the shadow away
  entirely instead of letting it extend past the card edges; restructured so the shadow sits on an
  outer `DecoratedBox` around the clip, and added the `-10`/`-2` spread-radius values both
  `GlassContainer` and `WobblioButton` were missing versus the web tokens. `flutter analyze`/`test`
  re-verified clean after both fixes.
- **No bottom-tab shell exists yet.** `app_shell.dart` is a 12-line passthrough to
  `DashboardScreen`. A real tab bar (Home / History / Budgets / ...) is out of scope for this epic —
  it only makes sense once a second top-level destination exists (tracked as a future epic alongside
  the 6 net-new `OPTION 2A` screens: Invoice Detail, History, Budgets, Reports, Account, Shopping
  List, Notifications, Split Bill).
- **Light "Solar" theme stays deferred.** The prototype and webapp both support a light toggle;
  `app_theme.dart` explicitly deferred it in 16a and this epic doesn't revisit that call.
- **Prototype vs. spec conflicts:** none identified yet at the epic-planning stage (only the Home/
  Capture/Review layouts were scoped, not deeply diffed against every backend field). Each slice
  file below must call out any conflict it finds between `OPTION 2A` markup and an existing backend
  contract or hard invariant, with the resolution taken.

## Conventions for every slice

- Flutter app lives in `Source/mobile/`. Follow `.claude/rules/flutter-architecture-guard.md`:
  widgets stay presentation-only; no business-logic changes in this epic (BLoCs/ports/adapters are
  untouched — this is a visual layer re-skin).
- Port component *behavior* from `Source/webapp/src/components/ds/*.tsx` where a direct analog
  exists; consult `Mobile UI design principles/Wobblio Mobile.html` (`OPTION 2A` section) for
  mobile-specific layout (spacing, viewfinder chrome, sheet sizing) the webapp has no analog for.
- `AuroraBackground` mounts once in `app.dart` (17a), behind every screen. Each screen's `Scaffold`
  must set `backgroundColor: Colors.transparent` for it to show through — that's part of every
  slice's re-skin, not a separate task.
- `fvm flutter analyze` (0 issues) + `fvm flutter test` (green) before marking a slice done.
- No new BLoC states, no new backend calls — if a slice seems to need one, stop and flag it; that's
  scope creep into a new-screen epic, not this redesign.
