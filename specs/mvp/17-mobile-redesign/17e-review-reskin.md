# 17e — Review Re-skin

**Mobile epic | Parent: [17 — Mobile Design-System Redesign](../17-mobile-redesign.md) · Tracker: [17-00](./17-00-handoff.md)**

Re-skin `ui/review/review_screen.dart`. Depends on `17a`.

## Reference

No single `OPTION 2A` screen maps 1:1 — that option merged the parse/correction step into
`<!-- 3 · INVOICE DETAIL (read-only) -->` plus generic tap-to-fix sheet conventions used across the
prototype (see `OPTION 1C`'s `<!-- 3 · PARSE (inline edit) -->` for the closest analog to this app's
actual tap-a-field-to-edit-inline model, since `1C` — unlike `2A` — still treats parse/correction as
its own screen). Use Invoice Detail's typographic/glass conventions for the read-only chrome (line
rows, amounts, dividers) and 1C's inline-edit affordances for what's actually editable here. This
screen's information architecture (photo top / fields bottom / single Confirm) already matches epic
16's requirements — this slice re-skins components, it doesn't restructure the layout.

## Scope

### Top: photo viewer
- Keep `InteractiveViewer` pinch-zoom behavior unchanged. Re-skin the surrounding chrome: swap the
  flat `ColoredBox` background for a subtle dark gradient (matches the prototype's photo-panel
  treatment) and the `AppBar` for a minimal glass header (back button + "Review receipt" title),
  consistent with `17c`'s header treatment.

### Bottom: fields
- `_FieldTile` (date, total) → `WobblioInput`-styled read-only-until-tapped tiles: use `GlassContainer`
  wrapping a label (uppercase, muted, `textXs`) + value (Outfit, tabular-nums for the total) + trailing
  edit affordance, replacing the Material `Card`+`ListTile`. Tapping still opens the existing date
  picker / number dialog — no interaction change.
- `_LineTile` → glass row using `MerchantIcon`-style leading badge swapped for a simple state icon
  (product matched vs. unmatched, keep `Icons.check_circle_outline`/`Icons.help_outline` semantics)
  and, critically, **the low-confidence background must become `WobblioInput`'s `flagged` treatment**
  (amber left-inset bar + tinted background) instead of the current flat
  `AppColors.warning.withValues(alpha: 0.12)` card fill — this is the one place `17a`'s `flagged`
  state has a real consumer; get the visual right here. Keep the `review-line-{id}` key and the
  "Low confidence — please check" copy.
- `_LineEditorSheet` (bottom sheet): re-skin its `TextField`s to `WobblioInput` (product search gets
  the `icon` slot for the search glyph), the save button to `WobblioButton(variant: primary)`. Keep
  the sheet's existing field set (product search, quantity, unit price, line total) and save behavior
  unchanged.
- `_ProductResults`: re-skin list rows (remove Material `ListTile` styling in favor of a plain glass
  row list inside the sheet), keep the checkmark-on-selected behavior.
- Discard button (`review-discard`) → `WobblioButton(variant: outline)` in `danger`-tinted colors
  (this is a destructive action — the design system doesn't define a dedicated "danger button"
  variant, so apply `AppColors.danger` as a one-off override on the outline variant here rather than
  adding a fourth button variant to `17a` for a single caller).
- Confirm button (`review-confirm`) → `WobblioButton(variant: primary, size: lg)`, spinner-while-busy
  behavior unchanged.
- `_numberDialog` (native `AlertDialog` for total editing): leave as a native dialog (re-skinning
  `AlertDialog` chrome app-wide is disproportionate for one call site) but restyle its `TextField` to
  match `WobblioInput`'s number-field look where practical within `AlertDialog`'s constraints.

## Out of scope
- Merchant tap-to-fix, add-tag picker — both already deferred to 16h (no endpoints yet); nothing to
  re-skin that doesn't exist.
- Any change to `ReviewBloc` events/states, `IReviewRepository`, or `IProductSearchRepository`.

## Checklist
- [ ] Photo header re-skinned; `InteractiveViewer` behavior unchanged
- [ ] Date/total tiles → glass tiles using the new tokens; tap behavior unchanged
- [ ] Line tiles: low-confidence uses `WobblioInput`'s `flagged` treatment; `Key`s preserved
- [ ] Line-editor sheet fields → `WobblioInput`; save behavior unchanged
- [ ] Discard/Confirm → `WobblioButton` (outline/danger and primary/lg respectively)
- [ ] No `ReviewBloc`/port changes
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green
