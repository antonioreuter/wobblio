# 18a — Bottom-Tab Shell

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

Rewrite `ui/shell/app_shell.dart`. Depends on `17a` (design-system tokens/widgets).

## Current state

`AppShell` is a 12-line passthrough straight to `DashboardScreen` — there has never been a second
destination to navigate to. `AuthGate` instantiates `AppShell()` unchanged; nothing above this layer
needs to change.

## Resolved conflict: 5-slot prototype nav vs. 3 built screens

`OPTION 2A`'s bottom nav (`Wobblio Mobile.dc.html`, `data-opt="d"`) has 5 slots: Dashboard · Receipts
· FAB (Capture) · Shopping · Reports. Reports has no screen yet in this epic. Per epic 17d's
precedent (dropping the notification bell rather than linking to a dead Notifications screen —
*"a bell with a permanently-unreachable target is worse than no bell"*), **this slice ships 4 slots**:
Home · Receipts · [Capture] · Shopping. Add the Reports slot back when `18e` builds that screen.

## Scope

- `AppShell` becomes a `StatefulWidget` owning:
  - A `Scaffold` with an `IndexedStack` body over `[DashboardScreen(), HistoryScreen(),
    ShoppingListScreen()]` (indices 0/1/2), each screen keeping its own inner `Scaffold`/`AppBar`/FAB
    exactly as `DashboardScreen` does today — only the bottom bar chrome lives in `AppShell`'s outer
    `Scaffold`.
  - A `BottomNavigationBar` (or `NavigationBar`) with 4 destinations: Home (index 0), Receipts
    (index 1), Capture (not an `IndexedStack` index — see below), Shopping (index 2).
  - `selectedIndex` as local `State` — no BLoC needed for this slice, it's pure navigation.
- **Capture button**: tapping it calls `Navigator.push(MaterialPageRoute(builder: (_) =>
  CaptureScreen()))` directly (matches the design's FAB-in-the-bar placement, and preserves
  `CaptureScreen`'s existing awaited-return-value navigation pattern — it's not a fourth
  `IndexedStack` tab).
- Re-skin the bar itself using design-system tokens (`AppColors.glassBorder` divider on top,
  brand-tinted selected state) rather than default Material styling, consistent with 17's chrome
  conventions — but this is presentational only; no new widget needs adding to
  `lib/ui/design_system/` for a standard bottom nav bar.

## Out of scope

- Reports tab/screen (`18e`, deferred).
- Any change to `DashboardScreen`, `CaptureScreen`, or their BLoCs.

## Checklist

- [ ] `AppShell` rewritten: `IndexedStack` over Home/Receipts/Shopping + bottom nav bar
- [ ] Capture button pushes `CaptureScreen` (not an `IndexedStack` tab)
- [ ] No Reports slot rendered
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green
