import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Obsidian Aurora color tokens, ported verbatim from
/// `Source/webapp/src/styles/ds/tokens/colors.css` (dark theme only — the
/// light "Solar" theme stays deferred, see `specs/mvp/17-mobile-redesign/17-00-handoff.md`).
class AppColors {
  const AppColors._();

  // ---- Raw palette --------------------------------------------------------
  static const indigo500 = Color(0xFF6366F1);
  static const indigo600 = Color(0xFF4F46E5);
  static const teal600 = Color(0xFF0D9488);
  static const amber500 = Color(0xFFF59E0B);
  static const rose500 = Color(0xFFF43F5E);
  static const slate500 = Color(0xFF64748B);
  static const slate400 = Color(0xFF94A3B8);
  static const white50 = Color(0xFFF8FAFC);

  // ---- Merchant brand colors (MerchantIcon) --------------------------------
  static const merchantAh = Color(0xFF00A1E2);
  static const merchantJumbo = Color(0xFFF59E0B);
  static const merchantDirk = Color(0xFFEF4444);
  static const merchantLidl = Color(0xFF8B5CF6);
  static const merchantTokomania = Color(0xFF10B981);
  static const merchantCantinho = Color(0xFFBE123C);

  // ---- Semantic surface tokens (dark) --------------------------------------
  static const background = Color(0xFF161A24); // --bg-color
  static const surface = Color(0xFF0F121B); // opaque glass fallback
  static const glassBg = Color(0xB80D111E); // rgba(13,17,30,0.72)
  static const glassBorder = Color(0x12FFFFFF); // rgba(255,255,255,0.07)
  static const glassHoverBorder = Color(0x406366F1); // rgba(99,102,241,0.25)
  static const glassHighlight = Color(0x05FFFFFF); // rgba(255,255,255,0.02)

  // ---- Semantic text --------------------------------------------------------
  static const textPrimary = white50;
  static const textSecondary = slate400;
  static const textMuted = slate500;

  // ---- Semantic accents -------------------------------------------------
  static const brand = indigo500;
  static const brandGlow = Color(0x406366F1); // rgba(99,102,241,0.25)
  static const brandHover = indigo600;
  static const brandBorder = Color(0x336366F1); // rgba(99,102,241,0.2) — badge/tag border

  static const success = teal600;
  static const successGlow = Color(0x260D9488); // rgba(13,148,136,0.15)
  static const successBorder = Color(0x330D9488); // rgba(13,148,136,0.2)

  static const warning = amber500;
  static const warningGlow = Color(0x26F59E0B); // rgba(245,158,11,0.15)
  static const warningBorder = Color(0x33F59E0B); // rgba(245,158,11,0.2)

  static const danger = rose500;
  static const dangerGlow = Color(0x26F43F5E); // rgba(244,63,94,0.15)
  static const dangerBorder = Color(0x33F43F5E); // rgba(244,63,94,0.2)

  /// `brand`→`teal600` diagonal gradient used by [Avatar]'s default background.
  static const gradientAvatar = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brand, brandHover],
  );

  /// `indigo500`→`teal600` gradient used by [WobblioLogo]'s stroke and the
  /// capture screen's shutter fill.
  static const gradientBrand = LinearGradient(
    colors: [indigo500, teal600],
  );
}

/// Spacing, radius and control-sizing tokens, ported from
/// `Source/webapp/src/styles/ds/tokens/spacing.css`.
class AppSpacing {
  const AppSpacing._();

  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 20.0;
  static const s6 = 24.0;
  static const s8 = 32.0;

  static const radiusSm = 6.0; // tags, chips, small badges
  static const radiusMd = 8.0; // inputs / list rows / merchant badge
  static const radiusLg = 12.0; // buttons, dropzones
  static const radiusXl = 16.0; // glass cards
  static const radius2xl = 20.0; // app shell
  static const radiusPill = 9999.0;

  static const controlHeight = 44.0; // min touch target
  static const controlHeightSm = 34.0;
  static const iconButton = 42.0;
}

/// Typography tokens, ported from `Source/webapp/src/styles/ds/tokens/typography.css`.
/// Outfit is the display face (titles, metrics, totals); Inter is body/dense UI.
/// Financial figures always use tabular figures.
class AppTypography {
  const AppTypography._();

  static const text2xs = 11.0; // badge / overline
  static const textXs = 12.0; // metadata
  static const textSm = 13.5; // dense table / labels
  static const textMd = 14.0; // body default
  static const textLg = 17.0; // lead paragraph
  static const textXl = 20.0; // card title
  static const text2xl = 24.0; // pane title
  static const text3xl = 32.0; // metric value
  static const text4xl = 42.0; // section title

  static const trackingWide = 0.05; // em — multiply by font size for letterSpacing

  /// Display face (Outfit) at [size]/[weight]/[color], optionally tabular-nums
  /// for money and other aligned figures.
  static TextStyle display({
    required double size,
    FontWeight weight = FontWeight.w700,
    Color color = AppColors.textPrimary,
    bool tabularNumbers = false,
  }) {
    return GoogleFonts.outfit(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: -0.02 * size,
      fontFeatures: tabularNumbers ? const [FontFeature.tabularFigures()] : null,
    );
  }

  /// Body face (Inter) at [size]/[weight]/[color].
  static TextStyle body({
    required double size,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.textPrimary,
  }) {
    return GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color);
  }

  /// Uppercase, letter-spaced overline/label style (badges, section headers).
  static TextStyle overline({
    double size = text2xs,
    Color color = AppColors.textMuted,
    FontWeight weight = FontWeight.w600,
  }) {
    return GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: trackingWide * size,
    );
  }
}
