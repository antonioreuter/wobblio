import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// One tab in the [WobblioNavBar] (the capture button is not a tab — it's the
/// raised centre FAB, wired separately via [WobblioNavBar.onCapture]).
class WobblioNavItem {
  const WobblioNavItem({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

/// Ports `OPTION 2A`'s floating bottom nav (`.bnav`/`.navbtn`/`.fab`): a glass
/// pill hovering above the content with a raised, gradient capture FAB spliced
/// into the middle. Active tabs show the brand dot + brand-tinted glyph/label.
///
/// [currentIndex] indexes [items]; the FAB sits after the first [captureIndex]
/// items and calls [onCapture] rather than selecting a tab.
class WobblioNavBar extends StatelessWidget {
  const WobblioNavBar({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelect,
    required this.onCapture,
    this.captureIndex = 2,
  });

  final List<WobblioNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;
  final VoidCallback onCapture;
  final int captureIndex;

  static const double _height = 70;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(24);
    final leading = items.take(captureIndex).toList();
    final trailing = items.skip(captureIndex).toList();

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        // Glass pill with the tab row (a fixed gap in the middle for the FAB).
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: radius,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.6),
                blurRadius: 36,
                spreadRadius: -12,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: radius,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                height: _height,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.navBg,
                  borderRadius: radius,
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < leading.length; i++)
                      Expanded(child: _tab(leading[i], i)),
                    const SizedBox(width: 60),
                    for (var i = 0; i < trailing.length; i++)
                      Expanded(child: _tab(trailing[i], captureIndex + i)),
                  ],
                ),
              ),
            ),
          ),
        ),
        // Raised capture FAB, centred over the middle gap.
        Positioned(top: -16, child: _CaptureFab(onTap: onCapture)),
      ],
    );
  }

  Widget _tab(WobblioNavItem item, int index) {
    final active = index == currentIndex;
    final color = active ? AppColors.brand : AppColors.textMuted;
    return InkWell(
      onTap: () => onSelect(index),
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 5,
              child: active
                  ? Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: AppColors.brand,
                        shape: BoxShape.circle,
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 5),
            Icon(item.icon, size: 23, color: color),
            const SizedBox(height: 5),
            Text(
              item.label,
              style: AppTypography.body(
                  size: 10, weight: FontWeight.w600, color: color,),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaptureFab extends StatelessWidget {
  const _CaptureFab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 60,
        height: 60,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: AppColors.gradientBrand,
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: AppColors.brand.withValues(alpha: 0.6),
              blurRadius: 30,
              spreadRadius: -6,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: const Icon(LucideIcons.camera, size: 27, color: Colors.white),
      ),
    );
  }
}
