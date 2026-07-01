import 'dart:ui';

import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `Card.tsx`'s `.glass` surface: translucent fill, hairline border,
/// blurred backdrop, soft drop shadow, 16px radius. Flutter has no `:hover`,
/// so [interactive] only affects the tap ripple, not a resting-state style —
/// callers wrap this in `InkWell`/`GestureDetector` themselves when tappable.
class GlassContainer extends StatelessWidget {
  const GlassContainer({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.s6),
    this.borderRadius = AppSpacing.radiusXl,
    this.borderColor = AppColors.glassBorder,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);
    // The drop shadow lives on this outer DecoratedBox, not inside the
    // ClipRRect below — a BoxShadow paints beyond its box's own edges, and a
    // shadow nested inside a ClipRRect of the same bounds gets clipped away
    // entirely instead of softly extending past the card.
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 40,
            spreadRadius: -10,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              color: AppColors.glassBg,
              borderRadius: radius,
              // Approximates the web's inset highlight
              // (`0 0 1px 1px rgba(255,255,255,.05) inset`) with this hairline
              // border rather than a second inset-shadow layer — Flutter has
              // no native inset box-shadow, and the visual difference at this
              // alpha is imperceptible.
              border: Border.all(color: borderColor),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
