import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Re-exports the design-system color tokens under the name existing screens
/// already import (`AppColors`), so `17a` can land without touching every
/// screen at once — `17b`–`17e` migrate call sites to the richer widget set.
export 'package:wobblio/ui/design_system/tokens.dart' show AppColors;

/// Builds the dark [ThemeData] used app-wide, sourced from the Obsidian Aurora
/// tokens ported in `ui/design_system/tokens.dart`. Outfit (display) + Inter
/// (body) load via `google_fonts`, matching the webapp's Google Fonts CDN load.
class AppTheme {
  const AppTheme._();

  static ThemeData get dark {
    const scheme = ColorScheme.dark(
      primary: AppColors.brand,
      onPrimary: Colors.white,
      secondary: AppColors.success,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.danger,
    );

    final base = GoogleFonts.interTextTheme(
        ThemeData(brightness: Brightness.dark).textTheme,);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: base.copyWith(
        bodyLarge: base.bodyLarge?.copyWith(color: AppColors.textPrimary),
        bodyMedium: base.bodyMedium?.copyWith(color: AppColors.textSecondary),
        labelSmall: base.labelSmall?.copyWith(color: AppColors.textMuted),
      ),
    );
  }

  /// Text style for monetary amounts: Outfit display face, tabular figures so
  /// columns of currency align (a hard webapp rule). Existing screens
  /// (pre-`17b`–`17e`) use this as a plain style; call [AppTypography.display]
  /// directly wherever a custom size/color is needed.
  static TextStyle get money => AppTypography.display(
      size: AppTypography.textMd,
      weight: FontWeight.w700,
      tabularNumbers: true,);
}
