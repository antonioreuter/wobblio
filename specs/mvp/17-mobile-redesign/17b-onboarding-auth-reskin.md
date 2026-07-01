# 17b — Onboarding & Login Re-skin

**Mobile epic | Parent: [17 — Mobile Design-System Redesign](../17-mobile-redesign.md) · Tracker: [17-00](./17-00-handoff.md)**

Re-skin `ui/auth/login_screen.dart` and `ui/onboarding/onboarding_required_screen.dart` to the
prototype's Onboarding splash layout. Depends on `17a` (uses `WobblioLogo`, `WobblioButton`,
`GlassContainer`, `AppColors`/`AppTypography`).

## Reference

`Mobile UI design principles/Wobblio Mobile.html`, `OPTION 2A` → `<!-- 0 · ONBOARDING -->`: full-bleed
dark background (the shared `AuroraBackground` from `17a` — mounted once in `app.dart`, nothing to
add here), `WobblioLogo` mark top-left, `EINDHOVEN · BETA` overline (`brand` color, uppercase,
`trackingWide`), headline "Scan your receipts.\nOutsmart inflation." (Outfit, 38px, `weightBlack`), a
hairline divider, a sub-line, a full-width primary CTA, and trust copy below it
("No bank connection · GDPR-compliant · delete anytime").

## Scope

### `login_screen.dart`
- Layout: logo mark → overline → headline → hairline (`Divider` or 1px `Container` in
  `AppColors.glassBorder`) → body copy → CTA → trust line, vertically centered as today.
- CTA: `WobblioButton(variant: primary, size: lg)`. **Keep the existing "Sign in" label and
  `AuthLoginRequested` behavior** — the prototype's "Start scanning free" copy assumes a
  marketing/signup framing that doesn't match this screen's actual job (Cognito Hosted-UI sign-in
  for an existing or new user); don't relabel a button to promise something it doesn't do.
- Busy state: swap CTA for the loading state — either disable `WobblioButton` and show an inline
  spinner, or gate the whole CTA row behind `isBusy` as today. `error` renders below in
  `AppColors.danger`, unchanged.
- Trust line: static text under the CTA, `textMuted`, `textXs`, centered — matches the prototype's
  GDPR reassurance copy pattern (`.claude/rules/gdpr-privacy-officer.md` territory only in spirit —
  this is copy, not a compliance change).

### `onboarding_required_screen.dart`
- Same shell (logo, headline, body, single CTA) but content stays as-is: "Finish setting up" /
  redirect-to-web copy / sign-out `TextButton` → `WobblioButton(variant: text)`. No prototype screen
  covers this state (it's a Wobblio-mobile-specific gate, not in the 11-screen prototype) — reuse the
  same visual shell as login for consistency, don't invent new layout.

## Out of scope
- Any new copy/marketing content beyond matching visual chrome.
- `EINDHOVEN · BETA` overline is cosmetic flavor text from the prototype — include it only if it
  reads true for the current launch state (check `docs/wobblio_v2.4_specification_final.md` launch-market
  language before hard-coding a claim); otherwise drop it rather than ship an inaccurate badge.

## Checklist
- [ ] `login_screen.dart` re-skinned: logo, overline (if accurate), headline, divider, body, CTA, trust line
- [ ] `onboarding_required_screen.dart` re-skinned to the same shell, existing copy/behavior unchanged
- [ ] No `AuthBloc` event/state changes
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green
