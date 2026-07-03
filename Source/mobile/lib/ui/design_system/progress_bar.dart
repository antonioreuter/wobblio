import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

enum ProgressTone { success, warning, danger }

/// Ports `ProgressBar.tsx`: an 8px pill track, fill color auto-selected by
/// [value] thresholds (>=85 danger, >=75 warning, else success) unless [tone]
/// forces one, with an optional 85%-mark tick. Animates from 0 on mount when
/// [animate] is set, skipped under `MediaQuery.disableAnimations` (this app's
/// equivalent of the web's `prefers-reduced-motion`).
class ProgressBar extends StatefulWidget {
  const ProgressBar(
      {super.key,
      required this.value,
      this.tone,
      this.showThreshold = true,
      this.animate = false,});

  final double value;
  final ProgressTone? tone;
  final bool showThreshold;
  final bool animate;

  @override
  State<ProgressBar> createState() => _ProgressBarState();
}

class _ProgressBarState extends State<ProgressBar> {
  double _target = 0;
  late final bool _reduceMotion;

  @override
  void initState() {
    super.initState();
    _reduceMotion = WidgetsBinding
        .instance.platformDispatcher.accessibilityFeatures.disableAnimations;
    final pct = widget.value.clamp(0, 100).toDouble();
    if (widget.animate && !_reduceMotion) {
      _target = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _target = pct);
      });
    } else {
      _target = pct;
    }
  }

  // The animate-from-0 flourish above only applies on mount — once mounted, a
  // live value (e.g. a budget bar refreshing after a new invoice posts) must
  // keep tracking widget.value on every rebuild, not just the value seen in
  // initState.
  @override
  void didUpdateWidget(covariant ProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      setState(() => _target = widget.value.clamp(0, 100).toDouble());
    }
  }

  @override
  Widget build(BuildContext context) {
    final pct = widget.value.clamp(0, 100).toDouble();
    final auto = pct >= 85
        ? ProgressTone.danger
        : (pct >= 75 ? ProgressTone.warning : ProgressTone.success);
    final fill = _colorFor(widget.tone ?? auto);

    return Semantics(
      label: 'Progress ${pct.round()} percent',
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Container(
            height: 8,
            decoration: BoxDecoration(
                color: AppColors.glassBorder,
                borderRadius: BorderRadius.circular(AppSpacing.radiusPill),),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                AnimatedContainer(
                  duration: _reduceMotion
                      ? Duration.zero
                      : const Duration(milliseconds: 800),
                  width: constraints.maxWidth * (_target / 100),
                  decoration: BoxDecoration(
                      color: fill,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusPill),),
                ),
                if (widget.showThreshold)
                  Positioned(
                    left: constraints.maxWidth * 0.85,
                    top: 0,
                    bottom: 0,
                    child: Container(
                        width: 1.5, color: Colors.white.withValues(alpha: 0.3),),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Color _colorFor(ProgressTone tone) => switch (tone) {
        ProgressTone.success => AppColors.success,
        ProgressTone.warning => AppColors.warning,
        ProgressTone.danger => AppColors.danger,
      };
}
