# 17a — Design-System Foundation (tokens + shared widgets)

**Mobile epic | Parent: [17 — Mobile Design-System Redesign](../17-mobile-redesign.md) · Tracker: [17-00](./17-00-handoff.md)**

Port the Obsidian Aurora design system from `Source/webapp/src/components/ds/` +
`Source/webapp/src/styles/ds/tokens/` into a reusable Flutter widget library under
`lib/ui/design_system/`. This is the only slice that touches shared chrome (`app.dart`,
`app_theme.dart`); `17b`–`17e` consume what lands here and touch nothing else.

## Dependencies

- None beyond what's already in `pubspec.yaml`. Adds two new dependencies (below).

## New dependencies

- **`google_fonts`** — loads Outfit (display) + Inter (body) at runtime, cached after first fetch,
  mirroring the webapp's Google Fonts CDN load. Confirmed with the user over bundling static `.ttf`
  assets (2026-07-01): keeps the repo free of font binaries.
- **`lucide_icons`** — the webapp's icon system is Lucide (`lucide-react`); this package exposes the
  same glyph set as `IconData` for use with a plain `Icon` widget. Use it for every icon **except**
  the Wobblio logo mark (bespoke artwork, ported as a `CustomPainter` below) and merchant glyphs
  (also custom paths, see `MerchantIcon`).

## Token port (`lib/ui/design_system/tokens.dart`)

Source: `Source/webapp/src/styles/ds/tokens/{colors,spacing,typography,effects}.css` (verified
byte-identical to the prototype's `_ds/*/tokens/*.css`, so no cross-checking needed against the
HTML prototype for values — only for layout).

```dart
class AppColors {
  // Raw palette
  static const indigo500 = Color(0xFF6366F1);
  static const indigo600 = Color(0xFF4F46E5);
  static const teal600   = Color(0xFF0D9488);
  static const amber500  = Color(0xFFF59E0B);
  static const rose500   = Color(0xFFF43F5E);
  static const slate500  = Color(0xFF64748B);
  static const slate400  = Color(0xFF94A3B8);
  static const white50    = Color(0xFFF8FAFC);

  // Merchant brand colors (MerchantIcon)
  static const merchantAh        = Color(0xFF00A1E2);
  static const merchantJumbo     = Color(0xFFF59E0B);
  static const merchantDirk      = Color(0xFFEF4444);
  static const merchantLidl      = Color(0xFF8B5CF6);
  static const merchantTokomania = Color(0xFF10B981);
  static const merchantCantinho  = Color(0xFFBE123C);

  // Semantic (dark theme only — light "Solar" stays deferred, see 17-00)
  static const bgColor    = Color(0xFF161A24);
  static const glassBg    = Color(0xB80D111E);  // rgba(13,17,30,0.72)
  static const glassBorder       = Color(0x12FFFFFF); // rgba(255,255,255,0.07)
  static const glassHoverBorder  = Color(0x406366F1); // rgba(99,102,241,0.25)
  static const glassHighlight    = Color(0x05FFFFFF); // rgba(255,255,255,0.02)

  static const textPrimary   = white50;
  static const textSecondary = slate400;
  static const textMuted     = slate500;

  static const brand      = indigo500;
  static const brandGlow  = Color(0x406366F1); // rgba(99,102,241,0.25)
  static const brandHover = indigo600;
  static const success      = teal600;
  static const successGlow  = Color(0x260D9488); // rgba(13,148,136,0.15)
  static const warning      = amber500;
  static const warningGlow  = Color(0x26F59E0B); // rgba(245,158,11,0.15)
  static const danger       = rose500;
  static const dangerGlow   = Color(0x26F43F5E); // rgba(244,63,94,0.15)
}

class AppSpacing {
  static const s1 = 4.0, s2 = 8.0, s3 = 12.0, s4 = 16.0, s5 = 20.0, s6 = 24.0, s8 = 32.0;
  static const radiusSm = 6.0, radiusMd = 8.0, radiusLg = 12.0, radiusXl = 16.0, radius2xl = 20.0;
  static const radiusPill = 9999.0;
  static const controlHeight = 44.0, controlHeightSm = 34.0, iconButton = 42.0;
}

class AppTypography {
  // font families resolved via GoogleFonts.outfit()/.inter() text styles, not raw strings
  static const text2xs = 11.0, textXs = 12.0, textSm = 13.5, textMd = 14.0, textLg = 17.0;
  static const textXl = 20.0, text2xl = 24.0, text3xl = 32.0, text4xl = 42.0;
  static const weightRegular = FontWeight.w400, weightMedium = FontWeight.w500;
  static const weightSemibold = FontWeight.w600, weightBold = FontWeight.w700, weightBlack = FontWeight.w800;
  static const trackingWide = 0.05; // letterSpacing is in logical px in Flutter, not em — compute
                                     // per font size at call site (0.05em * fontSize)
}
```

Alpha-channel hex above is `AA` prefix on `RRGGBBAA`→ double check with `Color.fromRGBO` instead if
easier to keep exact web alpha values; either is fine as long as the rendered value matches.

## Widget port map

Each row: web source → Flutter widget (new file under `lib/ui/design_system/`) → notable behavior
to preserve.

| Web source | Flutter widget | Notes |
|---|---|---|
| `Card.tsx` | `GlassContainer` | `.glass` = `glassBg` fill, 1px `glassBorder`, `radiusXl`, soft shadow (`BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 40, offset: Offset(0,16))`), `BackdropFilter(ImageFilter.blur(sigmaX:20,sigmaY:20))`. `interactive: bool` param — Flutter has no `:hover`; treat interactive as "wrap in `InkWell`/`GestureDetector` with a pressed-state border color shift toward `glassHoverBorder`" instead of the web's hover lift. Default padding `space6` (24). |
| `Button.tsx` | `WobblioButton` | Variants `primary/outline/text`, sizes `md/lg`. Primary: `brand` fill, white text, glow shadow. Outline: transparent + `glassBorder`. Text: transparent, `textSecondary`. `iconLeft`/`iconRight` slots. Disabled → 50% opacity, no press feedback. |
| `Badge.tsx` | `WobblioBadge` | Tone enum `primary/success/warning/danger` → `{tone}Glow` background + `{tone}` text + 1px border at ~20% opacity of the tone color. Uppercase, `text2xs`, `weightSemibold`, pill radius, letter-spacing `trackingWide`. |
| `Tag.tsx` | `WobblioTag` | `glassHighlight` bg, `glassBorder` border, `radiusSm`, `text2xs`-ish (web uses 11px flat, not a token — keep 11.0 literal to match). Optional `removable` renders a trailing `×` tap target calling `onRemove`. |
| `Input.tsx` | `WobblioInput` | Wraps `TextField`. States: default (`glassBorder`), focused (`brand` border + `brandGlow` outer glow — approximate the web's `box-shadow` ring with a `Container` decoration, not a native `TextField` focus ring), `flagged` (amber border + a 4px amber inset-left bar — approximate with a `Border(left: BorderSide(width:4, color: warning))`). Optional leading `icon` and `label` (uppercase, `textXs`, `weightSemibold`, muted or warning color when flagged). This is the widget the review screen's tap-to-fix fields use — get the `flagged` state right, it's load-bearing for 17e. |
| `Switch.tsx` | `WobblioSwitch` | Track `success` when on / `textMuted` when off, white thumb, 46×24 pill. Flutter's native `Switch` uses Material tone logic — build a small custom widget instead so on/off colors match exactly rather than fighting `SwitchThemeData`. |
| `Checkbox.tsx` | `WobblioCheckbox` | 20×20 box, `radiusSm`, `brand` fill + white ✓ when checked, transparent + `glassBorder` when not. Optional trailing label. |
| `MetricCard.tsx` | `MetricCard` | `GlassContainer` + label (uppercase, `textXs`, `weightSemibold`, muted, `trackingWide`) + value (Outfit, `text3xl`, `weightBlack`, tabular-nums) + optional delta line colored by `tone` (`neutral/success/warning/danger`). |
| `ProgressBar.tsx` | `ProgressBar` | 8px height track (`glassBorder` color), pill radius, fill color auto-selected by `value` thresholds (≥85 danger, ≥75 warning, else success) unless `tone` is forced. Optional 85%-mark tick line. `animate` grows fill width from 0 — use an `AnimationController`/`TweenAnimationBuilder`, respect `MediaQuery.disableAnimations` (Flutter's reduced-motion signal) the way the web respects `prefers-reduced-motion`. |
| `Avatar.tsx` | `Avatar` | Circle, `gradient-avatar` (`brand`→`brandHover` diagonal `LinearGradient`) unless a flat `background` override is given, initials centered, Outfit `weightBold`, font size `= size * 0.36`. |
| `MerchantIcon.tsx` | `MerchantIcon` | Rounded-square badge (`radiusMd`), brand color per merchant (prefix-match on lowercase merchant name — port the `MERCHANTS` map verbatim, including the `startsWith` matching semantics, not exact-match), glyph inside. Glyphs: `shopping-bag`/`shopping-cart`/`tag`/`coins`/`coffee`/`flame`/`utensils-crossed`/`receipt` — use the matching `lucide_icons` `IconData` (`LucideIcons.shoppingBag`, etc.) rather than hand-porting the raw SVG path data; visually equivalent, far less error-prone. Fallback: `textMuted` bg + `receipt` glyph + `?` — actually check the web fallback again: it uses the `receipt` icon, not `?`, for unknown merchants (the `?` in `MERCHANTS`/`FALLBACK.initials` is unused by the render — `MerchantIcon` never renders initials, only the glyph; don't port a dead code path). |
| `WobblioLogo.tsx` | `WobblioLogo` | Two overlapping cubic-bezier strokes, indigo→teal linear gradient, `strokeWidth 3.5`, round caps/joins. Port as a `CustomPainter`: the two path definitions translate directly to `Path.moveTo` + `Path.cubicTo` + `Path.lineTo` calls at the same control points (viewBox `0 0 48 32`, scale to `size`). `withWordmark` appends "wobbl" (`textPrimary`) + "io" (`brand`) in Outfit `weightBold`. |
| `AuroraBackground.tsx` | `AuroraBackground` | Three blurred radial-gradient blobs (indigo/teal/coral, `blur(120px)`) behind the content, `IgnorePointer`. Mount once in `app.dart` behind `AuthGate`, not per-screen. Drifting animation (`15–18s ease-in-out alternate`) — use a slow repeating `AnimationController` per blob with the CSS keyframe's translateY+scale; skip entirely (static blobs) if `MediaQuery.disableAnimations` is set. |
| *(no direct analog)* | — | `MerchantIcon`'s `CategoryIcon.tsx` counterpart is **not needed by any of the 5 in-scope screens** — skip it (YAGNI; add if a later screen needs it). |

## Theme wiring (`app_theme.dart`, `app.dart`)

- Extend `AppTheme.dark` to source colors from the new `AppColors` token file (keep the class,
  replace its body) and set `textTheme`/`primaryTextTheme` fonts to `GoogleFonts.interTextTheme()`
  as the base, with `GoogleFonts.outfit(...)` applied explicitly wherever the design calls for
  display type (headings, metric values, money) — Flutter has no CSS-style "two font families with
  per-element override" shortcut, so display styles are set per-widget, not globally.
- `AppTheme.money` becomes a helper that returns an Outfit tabular-nums `TextStyle` at a given size,
  used by both the dashboard hero figure and anywhere else money renders.
- Mount `AuroraBackground` in `app.dart` behind `AuthGate` (a `Stack`), so every authenticated and
  pre-auth screen gets the same drifting background without each screen re-implementing it.

## Out of scope

- Screen-level layout changes (17b–17e).
- Light "Solar" theme (still deferred, see 17-00).
- `CategoryIcon` port (no consumer yet).

## Checklist

- [x] `google_fonts` + `lucide_icons` added to `pubspec.yaml`
- [x] `lib/ui/design_system/tokens.dart` — colors, spacing/radii, typography ports
- [x] `GlassContainer`, `WobblioButton`, `WobblioBadge`, `WobblioTag`, `WobblioInput`,
      `WobblioSwitch`, `WobblioCheckbox`, `MetricCard`, `ProgressBar`, `Avatar`, `MerchantIcon`,
      `WobblioLogo`, `AuroraBackground` implemented under `lib/ui/design_system/`
- [x] `AppTheme.dark` re-sourced from the new token file; Outfit/Inter wired via `google_fonts`
- [x] `AuroraBackground` mounted once in `app.dart`
- [x] No screen under `ui/{auth,capture,dashboard,review,onboarding}/` changed in this slice
- [x] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green (49 passed)

## Verification

- [x] The existing smoke test (`test/smoke_test.dart`) renders the full app — including the new
      theme, `AppTheme.money`, and the mounted `AuroraBackground` — without exceptions.
- Visual spot-check against `Source/webapp`'s design-system page (if one exists) or the `.tsx`
  source directly — colors/radii/type should match, not just "look dark and glassy." **Not done
  yet**: no screen in this slice actually renders the new widgets on-screen (only `app.dart`/
  `app_theme.dart` changed); a real visual check happens in `17b`–`17e` once a screen uses them.
