import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

enum WobblioBadgeTone { primary, success, warning, danger }

/// Ports `Badge.tsx`: a small uppercase pill, tone-tinted glow background +
/// matching text + a faint tone-colored border.
class WobblioBadge extends StatelessWidget {
  const WobblioBadge(
      {super.key,
      required this.label,
      this.tone = WobblioBadgeTone.primary,
      this.icon,});

  final String label;
  final WobblioBadgeTone tone;

  /// Optional leading icon (e.g. a processing spinner takes this slot's place
  /// instead — callers building that state skip this widget entirely).
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = _colors();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 6),
          ],
          Text(
            label.toUpperCase(),
            style: AppTypography.overline(color: fg, weight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  (Color, Color, Color) _colors() => switch (tone) {
        WobblioBadgeTone.primary => (
            AppColors.brandGlow,
            AppColors.brand,
            AppColors.brandBorder
          ),
        WobblioBadgeTone.success => (
            AppColors.successGlow,
            AppColors.success,
            AppColors.successBorder
          ),
        WobblioBadgeTone.warning => (
            AppColors.warningGlow,
            AppColors.warning,
            AppColors.warningBorder
          ),
        WobblioBadgeTone.danger => (
            AppColors.dangerGlow,
            AppColors.danger,
            AppColors.dangerBorder
          ),
      };
}
