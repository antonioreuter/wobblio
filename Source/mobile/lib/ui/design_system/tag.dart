import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `Tag.tsx`: a small glass-highlight chip. [removable] adds a trailing
/// `×` tap target. [selected] (a 17d addition for the dashboard's tag filter
/// row, which `Tag.tsx` has no analog for — the webapp filters differently)
/// swaps the fill/border/text to brand-tinted when this tag is the active filter.
class WobblioTag extends StatelessWidget {
  const WobblioTag({
    super.key,
    required this.label,
    this.removable = false,
    this.onRemove,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final bool removable;
  final VoidCallback? onRemove;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tag = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: selected ? AppColors.brandGlow : AppColors.glassHighlight,
        border: Border.all(color: selected ? AppColors.brandBorder : AppColors.glassBorder),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: AppTypography.body(
              size: 11,
              color: selected ? AppColors.brand : AppColors.textSecondary,
            ),
          ),
          if (removable) ...[
            const SizedBox(width: 6),
            GestureDetector(
              onTap: onRemove,
              child: Text(
                '×',
                style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textSecondary),
              ),
            ),
          ],
        ],
      ),
    );
    if (onTap == null) return tag;
    return GestureDetector(onTap: onTap, child: tag);
  }
}
