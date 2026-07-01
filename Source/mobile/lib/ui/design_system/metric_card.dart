import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/tokens.dart';

enum MetricTone { neutral, success, warning, danger }

/// Ports `MetricCard.tsx`: a glass card with a muted uppercase label, a large
/// tabular-nums Outfit value, and an optional tone-colored delta line.
class MetricCard extends StatelessWidget {
  const MetricCard({super.key, required this.label, required this.value, this.delta, this.tone = MetricTone.neutral});

  final String label;
  final String value;
  final String? delta;
  final MetricTone tone;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      padding: const EdgeInsets.all(AppSpacing.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label.toUpperCase(), style: AppTypography.overline()),
          const SizedBox(height: 6),
          Text(value, style: AppTypography.display(size: AppTypography.text3xl, weight: FontWeight.w800, tabularNumbers: true)),
          if (delta != null) ...[
            const SizedBox(height: 4),
            Text(delta!, style: AppTypography.body(size: 13, color: _toneColor())),
          ],
        ],
      ),
    );
  }

  Color _toneColor() => switch (tone) {
        MetricTone.neutral => AppColors.textSecondary,
        MetricTone.success => AppColors.success,
        MetricTone.warning => AppColors.warning,
        MetricTone.danger => AppColors.danger,
      };
}
