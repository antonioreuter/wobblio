# 17c — Capture Re-skin

**Mobile epic | Parent: [17 — Mobile Design-System Redesign](../17-mobile-redesign.md) · Tracker: [17-00](./17-00-handoff.md)**

Re-skin `ui/capture/capture_screen.dart`. Depends on `17a`.

## Resolved conflict: prototype assumes a custom in-app camera — this app doesn't have one

The prototype's `<!-- 2 · CAPTURE -->` (`OPTION 2A`) is a **live custom camera viewfinder**: corner
guides, a laser-scan animation over a mock receipt, a shutter button, back/gallery buttons overlaid
on a camera feed. Building that would mean swapping `image_picker`'s native-camera-launch model
(`ICameraCapture` port, shipped in 16c) for a live preview stream (e.g. the `camera` package) — a new
port, new permission-handling surface, and a re-plumb of the EXIF-strip/compress pipeline immediately
after a raw preview frame instead of after a returned image file. That's new capability, not a visual
re-skin, and it's out of scope for this epic (see `17-00`'s scope rule: no new ports/backend calls).

**Resolution:** keep the existing three-source picker model (camera via OS-native UI, gallery, PDF)
unchanged. Re-skin *this* screen — the picker — with Obsidian Aurora chrome. A custom in-app
viewfinder, if ever wanted, is a separate future epic (new port + new package), not part of 17c.

## Scope

### `_SourceActions` (the three-button screen)
- Replace `AppBar` with a minimal header matching the prototype's dark capture chrome: back button
  (glass circular icon button, `AppColors.glassHighlight` bg) + "Scan receipt" title (Outfit,
  `weightSemibold`) — no gallery-shortcut icon on the right (that action already exists as one of the
  three source buttons below; don't duplicate it as prototype's top-right icon does, since here it
  isn't a live camera view competing for the primary gesture).
- Three source buttons become `WobblioButton(variant: outline, size: lg)` stacked with `AppSpacing.s3`
  gaps, each keeping its existing icon (camera / gallery / PDF) via `iconLeft`. Keep the existing
  `Key`s (`capture-camera-button`, `capture-gallery-button`, `capture-pdf-button`) — tests depend on them.
- Background: solid `AppColors.background` (this screen sits over the shared `AuroraBackground` from
  `app.dart`; no per-screen background change needed).

### `_ProgressOverlay`
- Re-skin as a `GlassContainer` centered card (not a full-bleed `ColoredBox`) holding the spinner +
  phase label, matching the prototype's processing-card aesthetic (see `Wobblio Mobile.html`
  `OPTION 2A` `<!-- 11 · PROCESSING -->` for the general glass-card-with-spinner chrome — the full
  multi-step "upload → validate → parse" progress visualization in that screen is its own new-screen
  epic in the backlog; here only borrow the card's *look*, not its step-by-step content, since
  `CapturePhase` already has its own 4 phases (`preparing/presigning/uploading/confirming`) mapped to
  existing labels — don't invent new phases to match the prototype's step list).
- Keep `Key('capture-progress')` and the existing phase→label switch unchanged.

## Out of scope
- Live camera viewfinder / custom shutter UI (see resolved conflict above).
- The full "11 · PROCESSING" multi-stage screen (upload/validate/parse as distinct visualized steps)
  — this screen only has 4 short-lived phases behind one overlay, already sufficient.

## Checklist
- [ ] Header re-skinned (glass back button + title), no functional change
- [ ] Source buttons → `WobblioButton(variant: outline, size: lg)`, existing `Key`s preserved
- [ ] `_ProgressOverlay` re-skinned as a centered `GlassContainer`, `Key('capture-progress')` preserved
- [ ] No `CaptureBloc` event/state/port changes
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green
