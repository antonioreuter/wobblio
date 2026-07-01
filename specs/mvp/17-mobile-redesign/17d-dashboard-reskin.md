# 17d — Dashboard (Home) Re-skin

**Mobile epic | Parent: [17 — Mobile Design-System Redesign](../17-mobile-redesign.md) · Tracker: [17-00](./17-00-handoff.md)**

Re-skin `ui/dashboard/dashboard_screen.dart`. Depends on `17a`.

## Resolved conflict: the prototype's Home shows data this app doesn't fetch

The prototype's `<!-- 1 · HOME (lean) -->` (`OPTION 2A`) is mostly **budgets/price-intelligence
widgets the mobile client has no data for**: a typographic hero spend figure with a month/week
toggle and projection-cap caption, a stacked progress bar, an "inflation pulse" card (your
price trend vs. the Eindhoven region + €-saved-by-switching-shops), a vs-last-month /
credits-remaining split row, and a category-budgets list with per-category progress bars.

`DashboardBloc`/`DashboardState` today only holds: the recent-invoices list, per-invoice feedback
verdicts, available tags, and `UsageSummary` (remaining credits). There is **no** budgets, inflation,
or spend-projection data wired into mobile at all — those come from the webapp's dashboard/reports
endpoints (Epics 09–11), which mobile has never called. Wiring them up is new integration work (new
repository ports, new BLoC fields), which is out of this epic's "no new backend calls / no new BLoC
state" boundary (`17-00`).

**Resolution:** re-skin only what the screen actually has data for — the header and the
recent-invoices list — using the prototype's *typographic and layout language* (ledger-row style,
colored status dot, tabular-nums money, glass surfaces) without fabricating the budgets/inflation
sections. Track "wire up budgets + inflation summary to mobile" as a follow-on epic once the new
Budgets/Reports screens (out of scope here, see `17-00`) are built — building the data plumbing
without a screen to show it in would be premature.

## Scope

### Header (replaces `AppBar`)
- `"Good evening, {name}"` (muted, small) / `"Your money"` (Outfit headline) stacked, left-aligned —
  swap in `"Receipts"` if no display name is available on `UsageSummary`/profile (check what's
  actually exposed before inventing a greeting with no name to fill it).
- Right side: avatar (`Avatar` widget, initials) — **no notification bell**. The prototype's bell
  deep-links to the Notifications screen, which doesn't exist in this epic's scope (`17-00`); a bell
  with a permanently-unreachable target is worse than no bell. Add it back when Notifications ships.
- Avatar tap: no-op for now (Account screen is out of scope) — render it as a static badge, not a
  button, so it doesn't imply a dead affordance.
- Usage pill (`_UsagePill`) moves from the `AppBar.actions` slot into this header row, re-styled as a
  small `WobblioBadge(tone: primary)` instead of plain `Text`.

### Recent-invoices list (`_InvoiceCard` → ledger row)
- Replace the Material `Card` + `CircleAvatar` layout with the prototype's ledger-row style: a small
  colored status dot (merchant-brand color when known via `MerchantIcon`'s color map, else a neutral
  dot) + merchant name (`weightSemibold`) + `"{date} · {status label}"` on one muted line + trailing
  tabular-nums amount, separated by hairline `AppColors.glassBorder` dividers instead of card margins
  (matches the prototype's dense list look more than boxed cards).
  - This changes the row's chrome only. **Keep everything else**: tap → `ReviewScreen`, tags row,
    thumbs up/down `_FeedbackRow`, and all existing `Key`s (`invoice-card-{id}`, `status-pill`,
    `feedback-up`, `feedback-down`) — tests depend on them.
- `_StatusPill` re-skinned as `WobblioBadge` with tone mapped from `StatusTone` (`processing→primary`,
  `success→success`, `warning→warning`, `danger→danger`); keep the processing spinner-in-place-of-icon
  behavior.
- Tag chips (`_TagFilterRow`, per-row tag `Chip`s): re-skin as `WobblioTag`. `ChoiceChip`'s
  selected-state semantics need an equivalent (e.g. a filled variant when selected) since `WobblioTag`
  as ported in `17a` has no built-in selected state — add one here if needed (`selected: bool` prop
  on `WobblioTag`, brand-tinted background) rather than back in `17a`, since it's this screen's own
  requirement.
- `_EmptyState` / `_RetryMessage`: re-skin text styles + swap the bare `Icon` for the same icon inside
  a soft brand-tinted circle (matches the prototype's "no card, icon speaks" restraint elsewhere),
  keep copy and retry button behavior unchanged.

### Capture FAB
- Keep `FloatingActionButton.extended` (no bottom-nav to relocate it into, per `17-00`) but re-skin its
  color to `AppColors.brand` with the `brandGlow` shadow the design system uses on primary actions,
  matching `WobblioButton(variant: primary)`'s look even though this stays a native `FAB` widget
  (swapping it for a custom widget isn't worth it just for shadow parity).

## Out of scope
- Hero spend card, inflation-pulse card, category-budgets list, month/week toggle — no data source
  (see resolved conflict above).
- Bottom-tab navigation.

## Checklist
- [ ] Header re-skinned: greeting/title, avatar (no bell), usage badge
- [ ] Recent-invoice rows re-skinned to ledger style; all existing `Key`s preserved
- [ ] `_StatusPill` → `WobblioBadge` with tone mapping; processing spinner preserved
- [ ] Tag chips → `WobblioTag` (add a `selected` variant if needed)
- [ ] Empty/retry states re-skinned, copy and behavior unchanged
- [ ] Capture FAB re-skinned to brand color + glow
- [ ] No `DashboardBloc` event/state changes; no new repository calls
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green
