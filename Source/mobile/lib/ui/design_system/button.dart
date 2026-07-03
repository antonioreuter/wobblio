import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

enum WobblioButtonVariant { primary, outline, text }

enum WobblioButtonSize { md, lg }

/// Ports `Button.tsx`. Primary is a filled brand button with a glow shadow;
/// outline is a hairline-bordered transparent button; text is a bare label.
/// [foregroundColor] lets a single caller (the review screen's destructive
/// Discard action) tint an outline button danger-red without adding a fourth
/// variant to the design system for one call site.
class WobblioButton extends StatelessWidget {
  const WobblioButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = WobblioButtonVariant.primary,
    this.size = WobblioButtonSize.md,
    this.iconLeft,
    this.iconRight,
    this.foregroundColor,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final WobblioButtonVariant variant;
  final WobblioButtonSize size;
  final IconData? iconLeft;
  final IconData? iconRight;
  final Color? foregroundColor;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || busy;
    final fontSize = size == WobblioButtonSize.lg
        ? AppTypography.textLg
        : AppTypography.textMd;
    final verticalPadding = size == WobblioButtonSize.lg ? 14.0 : 11.0;
    final fg = foregroundColor ?? _defaultForeground();

    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (busy)
          SizedBox(
            width: fontSize,
            height: fontSize,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
          )
        else ...[
          if (iconLeft != null) ...[
            Icon(iconLeft, size: fontSize, color: fg),
            const SizedBox(width: 8),
          ],
          Text(label,
              style: AppTypography.body(
                  size: fontSize, weight: FontWeight.w600, color: fg,),),
          if (iconRight != null) ...[
            const SizedBox(width: 8),
            Icon(iconRight, size: fontSize, color: fg),
          ],
        ],
      ],
    );

    return Opacity(
      opacity: disabled && !busy ? 0.5 : 1,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          boxShadow: variant == WobblioButtonVariant.primary
              ? const [
                  BoxShadow(
                      color: AppColors.brandGlow,
                      blurRadius: 20,
                      spreadRadius: -2,
                      offset: Offset(0, 4),),
                ]
              : null,
        ),
        child: Material(
          color: variant == WobblioButtonVariant.primary
              ? AppColors.brand
              : Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            side: variant == WobblioButtonVariant.outline
                ? BorderSide(color: foregroundColor ?? AppColors.glassBorder)
                : BorderSide.none,
          ),
          elevation: 0,
          child: InkWell(
            onTap: disabled ? null : onPressed,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            child: Padding(
              padding: EdgeInsets.symmetric(
                  horizontal: 24, vertical: verticalPadding,),
              child: Center(widthFactor: 1, child: content),
            ),
          ),
        ),
      ),
    );
  }

  Color _defaultForeground() => switch (variant) {
        WobblioButtonVariant.primary => Colors.white,
        WobblioButtonVariant.outline => AppColors.textPrimary,
        WobblioButtonVariant.text => AppColors.textSecondary,
      };
}
