import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/reports/price_report_bloc.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/inflation_sparkline.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/spend_breakdown/spend_breakdown_screen.dart';

/// Reports "Price report" screen (19f, prototype 2a `data-screen="6"`): a
/// personal-inflation CPI view — the caller's own price index vs. their region
/// (proportional bars + a dual-line sparkline) and the €-saved-by-switching
/// headline. Every figure is real or an honest building-state; nothing is
/// fabricated (rule #4). The per-product "Tracked items" list from the
/// prototype is deferred — it needs a new endpoint field surfacing the caller's
/// matched-basket breakdown (the data already lives in `PersonalInflationQueryAdapter`).
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PriceReportBloc>(
      create: (_) =>
          locator<PriceReportBloc>()..add(const PriceReportStarted()),
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
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: BlocBuilder<PriceReportBloc, PriceReportState>(
          builder: (context, state) {
            if (state.status == PriceReportStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == PriceReportStatus.failure) {
              return _RetryMessage(
                onRetry: () => context
                    .read<PriceReportBloc>()
                    .add(const PriceReportStarted()),
              );
            }
            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Header(regionLabel: state.regionLabel),
                  const SizedBox(height: 20),
                  const _SpendBreakdownEntry(),
                  const SizedBox(height: 16),
                  _Body(insight: state.insight),
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
  const _Header({required this.regionLabel});

  final String regionLabel;

  @override
  Widget build(BuildContext context) {
    final subtitle =
        regionLabel.isEmpty ? 'Last 90 days' : '$regionLabel · last 90 days';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Price report',
          style: AppTypography.display(size: AppTypography.text2xl),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: AppTypography.body(
            size: AppTypography.textXs,
            color: AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.insight});

  final InflationInsight? insight;

  @override
  Widget build(BuildContext context) {
    final data = insight;
    // Nothing real to show yet: one honest building-state, never fabricated bars.
    if (data == null || _isEmpty(data)) {
      return const _EmptyState();
    }
    final saved = data.savedBySwitching;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _InflationVsRegion(insight: data),
        if (data.trend.isNotEmpty) ...[
          const SizedBox(height: 20),
          Center(
              child: InflationSparkline(
                  trend: data.trend, width: 260, height: 64,),),
        ],
        if (saved != null && saved > 0) ...[
          const SizedBox(height: 22),
          _SavingsCard(saved: saved),
        ],
      ],
    );
  }

  bool _isEmpty(InflationInsight d) =>
      d.personalInflationPct == null &&
      d.regionInflationPct == null &&
      (d.savedBySwitching == null || d.savedBySwitching == 0) &&
      d.trend.isEmpty;
}

/// "Your inflation vs region": two fixed-series proportional bars — You (teal)
/// and Region (amber), matching the sparkline's series identity.
class _InflationVsRegion extends StatelessWidget {
  const _InflationVsRegion({required this.insight});

  final InflationInsight insight;

  @override
  Widget build(BuildContext context) {
    final personal = insight.personalInflationPct;
    final region = insight.regionInflationPct;
    final scale = _scale(personal, region);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Your inflation vs region'.toUpperCase(),
          style: AppTypography.overline(size: 11),
        ),
        const SizedBox(height: 12),
        _InflationBar(
          key: const Key('price-report-you'),
          label: 'You',
          pct: personal,
          color: AppColors.success,
          scale: scale,
        ),
        const SizedBox(height: 10),
        _InflationBar(
          key: const Key('price-report-region'),
          label: 'Region',
          pct: region,
          color: AppColors.warning,
          scale: scale,
        ),
        if (personal == null) ...[
          const SizedBox(height: 10),
          const _Hint(
            'Scan a few more receipts of items you buy regularly to see your '
            'own price index.',
          ),
        ] else if (region == null) ...[
          const SizedBox(height: 10),
          const _Hint('Regional comparison arrives as more shops are mapped.'),
        ],
      ],
    );
  }

  // Largest magnitude across both bars sets the axis (a hair of headroom); the
  // fill can't exceed the track. Falls back to 1 so a lone value still shows.
  double _scale(double? a, double? b) {
    final maxAbs = [
      if (a != null) a.abs(),
      if (b != null) b.abs(),
    ].fold<double>(0, (m, v) => v > m ? v : m);
    return maxAbs <= 0 ? 1 : maxAbs;
  }
}

class _InflationBar extends StatelessWidget {
  const _InflationBar({
    super.key,
    required this.label,
    required this.pct,
    required this.color,
    required this.scale,
  });

  final String label;
  final double? pct;
  final Color color;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final value = pct;
    return Row(
      children: [
        SizedBox(
          width: 54,
          child: Text(
            label,
            style: AppTypography.body(
              size: AppTypography.textXs,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: 18,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.glassBorder,
              borderRadius: BorderRadius.circular(5),
            ),
            child: value == null || value == 0
                ? null
                : Align(
                    alignment: Alignment.centerLeft,
                    child: FractionallySizedBox(
                      widthFactor: (value.abs() / scale).clamp(0.04, 1.0),
                      heightFactor: 1,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: color,
                          borderRadius: BorderRadius.circular(5),
                        ),
                      ),
                    ),
                  ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 52,
          child: Text(
            value == null ? '—' : _signed(value),
            textAlign: TextAlign.right,
            style: AppTypography.display(
              size: 13,
              weight: FontWeight.w700,
              tabularNumbers: true,
              color: value == null ? AppColors.textMuted : color,
            ),
          ),
        ),
      ],
    );
  }

  String _signed(double v) =>
      '${v > 0 ? '+' : v < 0 ? '−' : ''}${v.abs().toStringAsFixed(1)}%';
}

/// "€X saved this year by switching" — shown only when there's a real,
/// positive figure (the sum of buying below the region median).
class _SavingsCard extends StatelessWidget {
  const _SavingsCard({required this.saved});

  final double saved;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      key: const Key('price-report-savings'),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '€${saved.toStringAsFixed(0)}',
                style: AppTypography.display(
                  size: 34,
                  weight: FontWeight.w800,
                  tabularNumbers: true,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'saved this year by switching',
                style: AppTypography.body(
                  size: AppTypography.textXs,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'From buying below your region’s median price.',
            style: AppTypography.body(
              size: 12.5,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.body(
        size: AppTypography.textXs,
        color: AppColors.textMuted,
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          const Icon(Icons.show_chart, size: 40, color: AppColors.brand),
          const SizedBox(height: 14),
          Text(
            'Building your personal inflation index',
            style: AppTypography.display(size: 17, weight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Scan a few receipts of items you buy regularly and your own price '
            'index — and how it compares to your region — shows up here.',
            style: AppTypography.body(
              size: AppTypography.textSm,
              color: AppColors.textMuted,
            ),
            textAlign: TextAlign.center,
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
            'Couldn’t load your price report',
            style: AppTypography.body(size: AppTypography.textMd),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

/// Entry card into the hierarchical Spend Breakdown report — pushes
/// [SpendBreakdownScreen] over the Reports tab.
class _SpendBreakdownEntry extends StatelessWidget {
  const _SpendBreakdownEntry();

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const SpendBreakdownScreen()),
      ),
      borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
      child: const GlassContainer(
        child: Row(
          children: [
            Icon(Icons.pie_chart_outline, size: 22, color: AppColors.brand),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spend breakdown',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),),
                  SizedBox(height: 2),
                  Text(
                    'See where your money goes — drill by category and merchant',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 12.5,),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, size: 20, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
