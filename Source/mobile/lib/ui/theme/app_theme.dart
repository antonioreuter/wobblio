import 'package:flutter/material.dart';

/// Obsidian-Aurora color tokens, ported from the webapp design system
/// (`Source/webapp/src/styles/ds/tokens/colors.css`, dark `:root`). Dark is the
/// default; the light "Solar" theme is deferred to a later slice.
class AppColors {
  const AppColors._();

  static const Color background = Color(0xFF161A24); // --bg-color
  static const Color surface = Color(0xFF0F121B); // glass base, opaque
  static const Color textPrimary = Color(0xFFF8FAFC); // --text-primary
  static const Color textSecondary = Color(0xFF94A3B8); // --text-secondary
  static const Color textMuted = Color(0xFF64748B); // --text-muted

  static const Color brand = Color(0xFF6366F1); // Electric Indigo
  static const Color brandHover = Color(0xFF4F46E5);
  static const Color success = Color(0xFF0D9488); // Aurora Teal
  static const Color warning = Color(0xFFF59E0B); // Warm Amber
  static const Color danger = Color(0xFFF43F5E); // Sunset Coral
}

/// Builds the dark [ThemeData] used app-wide. Money figures use tabular
/// figures so columns of currency align (a hard webapp rule).
class AppTheme {
  const AppTheme._();

  static ThemeData get dark {
    const scheme = ColorScheme.dark(
      primary: AppColors.brand,
      onPrimary: AppColors.textPrimary,
      secondary: AppColors.success,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.danger,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: _textTheme,
    );
  }

  static const TextTheme _textTheme = TextTheme(
    bodyLarge: TextStyle(color: AppColors.textPrimary),
    bodyMedium: TextStyle(color: AppColors.textSecondary),
    labelSmall: TextStyle(color: AppColors.textMuted),
  );

  /// Text style for monetary amounts: tabular figures keep digits aligned.
  static const TextStyle money = TextStyle(
    color: AppColors.textPrimary,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}
