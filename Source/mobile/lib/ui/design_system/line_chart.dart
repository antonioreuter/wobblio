import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// One week's plotted value on a [TrendChartSeries]. [price] null means no
/// observation that week — rendered as a gap (`FlSpot.nullSpot`), never
/// coerced to zero. [discountPrice] (also from that same week, when present)
/// draws as a small standalone dot rather than joining the price line, since
/// it's a distinct signal ("this week's median included discounted units"),
/// not a second continuous series.
class TrendChartPoint {
  const TrendChartPoint({
    required this.weekIndex,
    this.price,
    this.discountPrice,
  });

  final int weekIndex;
  final double? price;
  final double? discountPrice;
}

/// One plotted line: a product's own-purchase history (dashed) or one
/// (product, merchant) market cell (solid). Purely a view model — no
/// `core/reports/` wire types leak in here, keeping this widget presentation-only
/// (`.claude/rules/flutter-architecture-guard.md`). The bloc/screen builds this
/// from the domain [PriceTrendComparison] before handing it to [TrendLineChart].
class TrendChartSeries {
  const TrendChartSeries({
    required this.label,
    required this.color,
    required this.dashed,
    required this.points,
  });

  final String label;
  final Color color;
  final bool dashed;
  final List<TrendChartPoint> points;
}

/// Ports the webapp's price-trend `LineChart` (dashed "your purchases" line,
/// solid per-store lines, discount markers) onto `fl_chart`'s `LineChart`
/// (18e). X axis is a plain week index — [weekLabels], when provided, supplies
/// the bottom-axis text for each index (e.g. "3 Jun").
class TrendLineChart extends StatelessWidget {
  const TrendLineChart({
    super.key,
    required this.series,
    this.weekLabels = const [],
    this.valueLabelBuilder,
    this.height = 220,
  });

  final List<TrendChartSeries> series;
  final List<String> weekLabels;

  /// Formats a left-axis price value. Defaults to a plain 2-decimal string —
  /// callers pass `formatMoney` (or similar) for a currency-aware label,
  /// keeping this widget itself currency-agnostic.
  final String Function(double value)? valueLabelBuilder;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (series.isEmpty || series.every(_hasNoData)) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            'No price points to chart',
            style: AppTypography.body(
              size: AppTypography.textSm,
              color: AppColors.textMuted,
            ),
          ),
        ),
      );
    }
    final labelInterval =
        weekLabels.length <= 6 ? 1 : (weekLabels.length / 6).ceil();
    return SizedBox(
      height: height,
      child: LineChart(
        LineChartData(
          gridData: FlGridData(
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                const FlLine(color: AppColors.glassBorder, strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 44,
                getTitlesWidget: _leftTitle,
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: weekLabels.isNotEmpty,
                reservedSize: 24,
                interval: labelInterval.toDouble(),
                getTitlesWidget: _bottomTitle,
              ),
            ),
          ),
          lineTouchData: const LineTouchData(enabled: true),
          lineBarsData: [
            for (final s in series) ...[_priceBar(s), _discountMarkers(s)],
          ],
        ),
      ),
    );
  }

  bool _hasNoData(TrendChartSeries s) =>
      s.points.every((p) => p.price == null && p.discountPrice == null);

  LineChartBarData _priceBar(TrendChartSeries s) => LineChartBarData(
        spots: [
          for (final p in s.points)
            p.price == null
                ? FlSpot.nullSpot
                : FlSpot(p.weekIndex.toDouble(), p.price!),
        ],
        color: s.color,
        barWidth: 2,
        isCurved: false,
        dashArray: s.dashed ? const [6, 4] : null,
        dotData: const FlDotData(show: false),
        belowBarData: BarAreaData(show: false),
      );

  // Discount markers render as a zero-width "line" — with no visible stroke,
  // only its dots paint — one per week whose median included discounted
  // units. Kept sparse (only discount weeks) rather than gap-filled with
  // `FlSpot.nullSpot`, since these points never connect to each other.
  LineChartBarData _discountMarkers(TrendChartSeries s) => LineChartBarData(
        spots: [
          for (final p in s.points)
            if (p.discountPrice != null)
              FlSpot(p.weekIndex.toDouble(), p.discountPrice!),
        ],
        color: Colors.transparent,
        barWidth: 0,
        dotData: FlDotData(
          show: true,
          getDotPainter: (spot, percent, bar, index) =>
              FlDotCirclePainter(radius: 3, color: s.color, strokeWidth: 0),
        ),
      );

  Widget _leftTitle(double value, TitleMeta meta) {
    final label = valueLabelBuilder?.call(value) ?? value.toStringAsFixed(2);
    return SideTitleWidget(
      axisSide: meta.axisSide,
      child: Text(
        label,
        style: AppTypography.body(
          size: AppTypography.text2xs,
          color: AppColors.textMuted,
        ),
      ),
    );
  }

  Widget _bottomTitle(double value, TitleMeta meta) {
    final index = value.round();
    if (index < 0 || index >= weekLabels.length) return const SizedBox.shrink();
    return SideTitleWidget(
      axisSide: meta.axisSide,
      child: Text(
        weekLabels[index],
        style: AppTypography.body(
          size: AppTypography.text2xs,
          color: AppColors.textMuted,
        ),
      ),
    );
  }
}
