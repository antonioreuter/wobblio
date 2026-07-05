import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:wobblio/core/reports/inflation_insight.dart';
import 'package:wobblio/ui/design_system/tokens.dart';

/// Two-line price-index sparkline (personal = teal, region = amber), 100-based over the trailing
/// months. Hidden until at least one series has two real points — never a straight fake line.
/// Shared by the Home inflation-pulse card and the Reports "Price report" screen.
class InflationSparkline extends StatelessWidget {
  const InflationSparkline({
    super.key,
    required this.trend,
    this.width = 116,
    this.height = 46,
  });

  final List<InflationTrendPoint> trend;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final personal = [for (final p in trend) p.personalIndexPct];
    final region = [for (final p in trend) p.regionIndexPct];
    final drawable = personal.whereType<double>().length >= 2 ||
        region.whereType<double>().length >= 2;
    if (!drawable) return const SizedBox.shrink();
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _SparklinePainter(personal: personal, region: region),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({required this.personal, required this.region});

  final List<double?> personal;
  final List<double?> region;

  @override
  void paint(Canvas canvas, Size size) {
    final all = [
      ...personal.whereType<double>(),
      ...region.whereType<double>(),
    ];
    if (all.isEmpty) return;
    var lo = all.reduce(math.min);
    var hi = all.reduce(math.max);
    if (hi - lo < 0.001) {
      lo -= 1;
      hi +=
          1; // flat data → give the axis a hair of range so the line sits mid-box
    }
    final n = personal.length;
    const pad = 5.0;
    double x(int i) => n <= 1 ? size.width / 2 : (i / (n - 1)) * size.width;
    double y(double v) =>
        size.height - pad - ((v - lo) / (hi - lo)) * (size.height - 2 * pad);

    _drawSeries(canvas, region, x, y, AppColors.warning);
    _drawSeries(canvas, personal, x, y, AppColors.success);
  }

  void _drawSeries(
    Canvas canvas,
    List<double?> series,
    double Function(int) x,
    double Function(double) y,
    Color color,
  ) {
    final stroke = Paint()
      ..color = color
      ..strokeWidth = 2.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    Path? path;
    Offset? last;
    for (var i = 0; i < series.length; i++) {
      final v = series[i];
      if (v == null) continue;
      final point = Offset(x(i), y(v));
      path == null
          ? path = (Path()..moveTo(point.dx, point.dy))
          : path.lineTo(point.dx, point.dy);
      last = point;
    }
    if (path != null) canvas.drawPath(path, stroke);
    if (last != null) {
      canvas.drawCircle(
        last,
        3.4,
        Paint()..color = color.withValues(alpha: 0.45),
      );
      canvas.drawCircle(last, 2.6, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter old) =>
      old.personal != personal || old.region != region;
}
