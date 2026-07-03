import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/reports/report_bloc.dart';
import 'package:wobblio/core/reports/price_trend_comparison.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/input.dart';
import 'package:wobblio/ui/design_system/line_chart.dart';
import 'package:wobblio/ui/design_system/tag.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';

/// Reports screen (18e): a price-trend comparison chart — product picker
/// (max 3), "My prices" vs. "Local market" toggle (market Premium-only),
/// [TrendLineChart]. Scoped down from `OPTION 2A`'s category/merchant
/// drill-down, which has no backend support — see
/// `specs/mvp/18-mobile-navigation-and-lists/18e-reports.md`.
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ReportBloc>(
      create: (_) => locator<ReportBloc>()..add(const ReportsStarted()),
      child: const _ReportsView(),
    );
  }
}

class _ReportsView extends StatelessWidget {
  const _ReportsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('reports-screen'),
      body: SafeArea(
        child: BlocConsumer<ReportBloc, ReportState>(
          listenWhen: (prev, curr) =>
              curr.notice != null && prev.notice != curr.notice,
          listener: (context, state) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          },
          builder: (context, state) {
            if (state.status == ReportStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == ReportStatus.failure) {
              return _RetryMessage(
                onRetry: () =>
                    context.read<ReportBloc>().add(const ReportsStarted()),
              );
            }
            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Header(state: state),
                  const SizedBox(height: 16),
                  const _ProductPicker(),
                  const SizedBox(height: 16),
                  _ModeToggle(state: state),
                  const SizedBox(height: 16),
                  _ChartCard(state: state),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.state});

  final ReportState state;

  @override
  Widget build(BuildContext context) {
    final region = state.regionCode.isEmpty
        ? 'Region not set'
        : '${state.country} · ${state.regionCode}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Reports',
          style: AppTypography.display(size: AppTypography.text2xl),
        ),
        const SizedBox(height: 2),
        Text(
          region,
          style: AppTypography.body(
            size: AppTypography.textXs,
            color: AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}

class _ProductPicker extends StatefulWidget {
  const _ProductPicker();

  @override
  State<_ProductPicker> createState() => _ProductPickerState();
}

class _ProductPickerState extends State<_ProductPicker> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ReportBloc, ReportState>(
      listenWhen: (prev, curr) =>
          curr.selectedProducts.length != prev.selectedProducts.length,
      listener: (context, state) => _controller.clear(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          WobblioInput(
            key: const Key('reports-product-search'),
            controller: _controller,
            label: 'Add a product',
            icon: Icons.search,
            onChanged: (q) =>
                context.read<ReportBloc>().add(ReportProductQueryChanged(q)),
          ),
          const _SuggestionsList(),
          const SizedBox(height: 10),
          const _SelectedChips(),
        ],
      ),
    );
  }
}

class _SuggestionsList extends StatelessWidget {
  const _SuggestionsList();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportBloc, ReportState>(
      buildWhen: (p, c) =>
          p.productSuggestions != c.productSuggestions ||
          p.atMaxProducts != c.atMaxProducts,
      builder: (context, state) {
        if (state.atMaxProducts || state.productSuggestions.isEmpty) {
          return const SizedBox.shrink();
        }
        return Padding(
          padding: const EdgeInsets.only(top: 6),
          child: GlassContainer(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final match in state.productSuggestions)
                  ListTile(
                    key: Key('reports-suggestion-${match.productId}'),
                    dense: true,
                    title: Text(
                      match.label,
                      style: AppTypography.body(size: AppTypography.textSm),
                    ),
                    onTap: () => context
                        .read<ReportBloc>()
                        .add(ReportProductAdded(match)),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SelectedChips extends StatelessWidget {
  const _SelectedChips();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportBloc, ReportState>(
      buildWhen: (p, c) => p.selectedProducts != c.selectedProducts,
      builder: (context, state) {
        if (state.selectedProducts.isEmpty) {
          return Text(
            'Search for a product to see its price history',
            style: AppTypography.body(
              size: AppTypography.textSm,
              color: AppColors.textMuted,
            ),
          );
        }
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in state.selectedProducts)
              WobblioTag(
                key: Key('reports-chip-${p.productId}'),
                label: p.displayName,
                removable: true,
                onRemove: () => context
                    .read<ReportBloc>()
                    .add(ReportProductRemoved(p.productId)),
              ),
          ],
        );
      },
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.state});

  final ReportState state;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ModeButton(
            key: const Key('reports-mode-own'),
            label: 'My prices',
            selected: state.mode == ReportMode.own,
            onTap: () => context
                .read<ReportBloc>()
                .add(const ReportModeChanged(ReportMode.own)),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ModeButton(
            key: const Key('reports-mode-market'),
            label: 'Local market',
            selected: state.mode == ReportMode.market,
            locked: !state.isPremium,
            onTap: state.isPremium
                ? () => context
                    .read<ReportBloc>()
                    .add(const ReportModeChanged(ReportMode.market))
                : () => _showUpsell(context),
          ),
        ),
      ],
    );
  }

  void _showUpsell(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Local market comparison is Premium'),
        content: const Text(
          'Upgrade on the web to compare your prices against local stores.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.locked = false,
  });

  final String label;
  final bool selected;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.brandGlow : AppColors.glassHighlight,
          border: Border.all(
            color: selected ? AppColors.brandBorder : AppColors.glassBorder,
          ),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (locked) ...[
              const Icon(
                Icons.lock_outline,
                size: 12,
                color: AppColors.textMuted,
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: AppTypography.body(
                size: AppTypography.textSm,
                weight: FontWeight.w600,
                color: selected ? AppColors.brand : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  const _ChartCard({required this.state});

  final ReportState state;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(child: _body());
  }

  Widget _body() {
    if (state.selectedProducts.isEmpty) {
      return _emptyMessage('Search for a product to see its price history.');
    }
    final comparison = state.comparison;
    if (comparison == null) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final chart = _buildChart(state);
    if (chart.series.isEmpty) {
      return _emptyMessage(
        state.mode == ReportMode.market
            ? 'No local-store prices yet for these products in this region — every scan makes it smarter.'
            : 'No prices yet for these products — scan a receipt to start tracking them.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TrendLineChart(
          series: chart.series,
          weekLabels: chart.weekLabels,
          valueLabelBuilder: (v) => formatMoney('EUR', v),
        ),
        const SizedBox(height: 12),
        for (final s in chart.series) _LegendRow(series: s),
      ],
    );
  }

  Widget _emptyMessage(String text) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.show_chart, size: 40, color: AppColors.brand),
              const SizedBox(height: 12),
              Text(
                text,
                style: AppTypography.body(
                  size: AppTypography.textSm,
                  color: AppColors.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({required this.series});

  final TrendChartSeries series;

  @override
  Widget build(BuildContext context) {
    final prices =
        [for (final p in series.points) p.price].whereType<double>().toList();
    final latest = prices.isEmpty ? null : prices.last;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration:
                BoxDecoration(color: series.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              series.label,
              style: AppTypography.body(
                size: AppTypography.textXs,
                color: AppColors.textSecondary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            latest == null ? '—' : formatMoney('EUR', latest),
            style: AppTypography.body(
              size: AppTypography.textXs,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _RetryMessage extends StatelessWidget {
  const _RetryMessage({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Couldn’t load your reports',
            style: AppTypography.body(size: AppTypography.textMd),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

// ── Chart view-model assembly ────────────────────────────────────────────────
// This is the "screen builds the view-model" half of the design-system
// contract: TrendLineChart never sees PriceTrendComparison/MarketTrendLine/
// OwnPurchaseLine directly (`.claude/rules/flutter-architecture-guard.md`).

const _seriesColors = [
  AppColors.brand,
  AppColors.success,
  AppColors.warning,
  AppColors.danger,
  Color(0xFF8B5CF6),
  Color(0xFF0EA5E9),
  Color(0xFF22C55E),
];

typedef _ChartData = ({List<TrendChartSeries> series, List<String> weekLabels});

_ChartData _buildChart(ReportState state) {
  final comparison = state.comparison;
  if (comparison == null) return (series: const [], weekLabels: const []);
  final weeks = _weeksUnion(comparison, state.mode);
  if (weeks.isEmpty) return (series: const [], weekLabels: const []);
  final labels = [for (final w in weeks) _shortDate(w)];
  final nameById = {
    for (final p in state.selectedProducts) p.productId: p.displayName,
  };
  final rawSeries = state.mode == ReportMode.market
      ? [
          for (var i = 0; i < comparison.lines.length; i++)
            _marketSeries(
              comparison.lines[i],
              weeks,
              nameById,
              _seriesColors[i % _seriesColors.length],
            ),
        ]
      : [
          for (var i = 0; i < comparison.ownHistory.length; i++)
            _ownSeries(
              comparison.ownHistory[i],
              weeks,
              nameById,
              _seriesColors[i % _seriesColors.length],
            ),
        ];
  // A line with no points at all in the visible weeks adds only legend noise.
  final visible = rawSeries
      .where(
        (s) => s.points.any((p) => p.price != null || p.discountPrice != null),
      )
      .toList();
  return (series: visible, weekLabels: labels);
}

// `comparison.lines`/`.ownHistory` are different (Equatable-only-shared)
// types, so this can't be a single ternary-selected list — iterated
// separately per branch instead.
List<String> _weeksUnion(PriceTrendComparison comparison, ReportMode mode) {
  final weeks = <String>{};
  if (mode == ReportMode.market) {
    for (final line in comparison.lines) {
      for (final point in line.points) {
        weeks.add(point.weekStart);
      }
    }
  } else {
    for (final line in comparison.ownHistory) {
      for (final point in line.points) {
        weeks.add(point.weekStart);
      }
    }
  }
  return weeks.toList()..sort();
}

TrendChartSeries _marketSeries(
  MarketTrendLine line,
  List<String> weeks,
  Map<String, String> nameById,
  Color color,
) {
  final byWeek = {for (final p in line.points) p.weekStart: p};
  final product = nameById[line.productId] ?? line.productId;
  return TrendChartSeries(
    label: '$product · ${line.merchantName}',
    color: color,
    dashed: false,
    points: _pointsFor(weeks, byWeek),
  );
}

TrendChartSeries _ownSeries(
  OwnPurchaseLine line,
  List<String> weeks,
  Map<String, String> nameById,
  Color color,
) {
  final byWeek = {for (final p in line.points) p.weekStart: p};
  final product = nameById[line.productId] ?? line.productId;
  return TrendChartSeries(
    label: '$product · Your purchases',
    color: color,
    dashed: true,
    points: _pointsFor(weeks, byWeek),
  );
}

List<TrendChartPoint> _pointsFor(
  List<String> weeks,
  Map<String, WeeklyMedianPoint> byWeek,
) =>
    [
      for (var i = 0; i < weeks.length; i++)
        TrendChartPoint(
          weekIndex: i,
          price: byWeek[weeks[i]]?.median,
          discountPrice: byWeek[weeks[i]]?.discountMedian,
        ),
    ];

const _monthAbbrev = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String _shortDate(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return '';
  return '${parsed.day} ${_monthAbbrev[parsed.month - 1]}';
}
