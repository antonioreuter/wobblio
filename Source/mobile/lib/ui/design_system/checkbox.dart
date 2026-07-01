import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `Checkbox.tsx`: a 20×20 box, brand fill + white check when checked,
/// transparent + hairline border when not, with an optional trailing label.
class WobblioCheckbox extends StatelessWidget {
  const WobblioCheckbox({super.key, required this.value, required this.onChanged, this.label});

  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final disabled = onChanged == null;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: GestureDetector(
        onTap: disabled ? null : () => onChanged!(!value),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: value ? AppColors.brand : Colors.transparent,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: Border.all(color: value ? AppColors.brand : AppColors.glassBorder),
              ),
              child: value
                  ? const Text('✓', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))
                  : null,
            ),
            if (label != null) ...[
              const SizedBox(width: 12),
              Flexible(child: Text(label!, style: AppTypography.body(size: AppTypography.textMd))),
            ],
          ],
        ),
      ),
    );
  }
}
