import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/core/bloc/budgets/budget_bloc.dart';
import 'package:wobblio/core/bloc/dashboard/dashboard_bloc.dart';
import 'package:wobblio/core/ingestion/invoice_status.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ingestion/usage_summary.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';
import 'package:wobblio/core/reports/spend_metrics.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/account/account_screen.dart';
import 'package:wobblio/ui/budgets/budgets_screen.dart';
import 'package:wobblio/ui/design_system/avatar.dart';
import 'package:wobblio/ui/design_system/inflation_sparkline.dart';
import 'package:wobblio/ui/design_system/merchant_icon.dart';
import 'package:wobblio/ui/design_system/progress_bar.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/format.dart';
import 'package:wobblio/ui/history/history_screen.dart';
import 'package:wobblio/ui/notifications/notifications_screen.dart';
import 'package:wobblio/ui/reports/reports_screen.dart';
import 'package:wobblio/ui/review/review_screen.dart';

/// Mobile home, re-skinned to `OPTION 2A` ("Spotlight Lean") in 19b: a
/// typographic "Your money" hero (grocery-spend total with a Month/Week
/// toggle), a Vs-last-period / Credits split row, a category-budgets preview,
/// and the recent-invoices ledger. The hero + Vs-last-period figures are
/// derived client-side from the invoice list ([computeSpendMetrics]); budgets
/// come from [BudgetBloc]; credits from [UsageSummary]. Capture now lives in
/// the shell's nav FAB, so this screen no longer owns a capture button.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<DashboardBloc>(
          create: (_) =>
              locator<DashboardBloc>()..add(const DashboardStarted()),
        ),
        BlocProvider<BudgetBloc>(
          create: (_) => locator<BudgetBloc>()..add(const BudgetsStarted()),
        ),
      ],
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatefulWidget {
  const _DashboardView();

  @override
  State<_DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<_DashboardView> {
  SpendPeriod _period = SpendPeriod.month;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('dashboard-screen'),
      backgroundColor: Colors.transparent,
      body: BlocConsumer<DashboardBloc, DashboardState>(
        listenWhen: (prev, curr) =>
            curr.notice != null && prev.notice != curr.notice,
        listener: (context, state) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(state.notice!)));
        },
        builder: (context, state) {
          if (state.status == DashboardStatus.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state.status == DashboardStatus.failure) {
            return _RetryMessage(
              onRetry: () =>
                  context.read<DashboardBloc>().add(const DashboardStarted()),
            );
          }
          return RefreshIndicator(
            onRefresh: () {
              final bloc = context.read<DashboardBloc>();
              bloc.add(const DashboardRefreshed());
              return bloc.stream.firstWhere((s) => !s.isRefreshing);
            },
            child: _Body(
              state: state,
              period: _period,
              onPeriod: (p) => setState(() => _period = p),
            ),
          );
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.state,
    required this.period,
    required this.onPeriod,
  });

  final DashboardState state;
  final SpendPeriod period;
  final ValueChanged<SpendPeriod> onPeriod;

  @override
  Widget build(BuildContext context) {
    // Prototype 2a Home shows a short "Recent" preview, not the full ledger —
    // the 3 most recent (newest-first from the backend). Full list is one tap
    // away via "See all".
    final invoices = state.invoices.take(3).toList();
    final currency =
        state.invoices.isNotEmpty ? state.invoices.first.currency : 'EUR';
    // Sum only same-currency invoices so the hero total and its symbol agree —
    // mobile has no home-currency field to convert into, and summing mixed
    // currencies would render a meaningless total under one symbol.
    final spendInvoices =
        state.invoices.where((inv) => inv.currency == currency);
    final now = DateTime.now();
    final metrics = computeSpendMetrics(spendInvoices, now, period);
    final composition = computeMerchantComposition(spendInvoices, now, period);

    // SafeArea gives the top inset (no AppBar to do it) and, via the bottom
    // padding the shell injects for the floating nav, the bottom clearance —
    // so no manual top/bottom spacer is needed.
    return SafeArea(
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          const SliverToBoxAdapter(child: _Header()),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _HeroSpend(
                    metrics: metrics,
                    currency: currency,
                    period: period,
                    onPeriod: onPeriod,
                    composition: composition,
                  ),
                  const SizedBox(height: AppSpacing.s5),
                  _InflationPulse(insight: state.inflation),
                  _MetricsSplitRow(
                    metrics: metrics,
                    currency: currency,
                    period: period,
                    usage: state.usage,
                  ),
                  const _CategoryBudgets(),
                  const SizedBox(height: AppSpacing.s6),
                  _RecentHeader(),
                ],
              ),
            ),
          ),
          if (invoices.isEmpty)
            const SliverToBoxAdapter(child: _EmptyState())
          else
            SliverList.builder(
              itemCount: invoices.length,
              itemBuilder: (context, i) => _InvoiceRow(invoice: invoices[i]),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    final name = context.select<AuthBloc, String>(_fullName);
    final first = _firstName(name);
    return Wobblio2aHeader(
      greeting: first == null ? null : '${_partOfDay()}, $first',
      title: 'Your money',
      actions: [
        HeaderIconButton(
          key: const Key('dashboard-notifications-button'),
          icon: LucideIcons.bell,
          tooltip: 'Notifications',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
          ),
        ),
        GestureDetector(
          key: const Key('dashboard-account-button'),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const AccountScreen()),
          ),
          child: Avatar(initials: _initials(name), size: 40),
        ),
      ],
    );
  }

  static String _fullName(AuthBloc b) {
    final s = b.state;
    return s is AuthAuthed ? s.profile.fullName : '';
  }

  static String? _firstName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    return parts.first.isEmpty ? null : parts.first;
  }

  static String _initials(String fullName) {
    final parts =
        fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    final letters = parts.take(2).map((p) => p[0].toUpperCase());
    return letters.join();
  }

  static String _partOfDay() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}

// ---------------------------------------------------------------------------
// Hero spend
// ---------------------------------------------------------------------------

class _HeroSpend extends StatelessWidget {
  const _HeroSpend({
    required this.metrics,
    required this.currency,
    required this.period,
    required this.onPeriod,
    required this.composition,
  });

  final SpendMetrics metrics;
  final String currency;
  final SpendPeriod period;
  final ValueChanged<SpendPeriod> onPeriod;
  final List<SpendSlice> composition;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Total grocery spend'.toUpperCase(),
              style: AppTypography.overline(size: 11),
            ),
            _PeriodToggle(period: period, onPeriod: onPeriod),
          ],
        ),
        const SizedBox(height: AppSpacing.s2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Flexible(
              child: Text(
                formatMoney(currency, metrics.current),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.display(
                  size: 44,
                  weight: FontWeight.w800,
                  tabularNumbers: true,
                ),
              ),
            ),
            if (metrics.deltaPct != null) ...[
              const SizedBox(width: AppSpacing.s3),
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Text(
                  '${metrics.spendingDown ? '↓' : '↑'} '
                  '${formatMoney(currency, metrics.diff.abs())}',
                  style: AppTypography.display(
                    size: 13,
                    weight: FontWeight.w700,
                    tabularNumbers: true,
                    color: metrics.spendingDown
                        ? AppColors.success
                        : AppColors.warning,
                  ),
                ),
              ),
            ],
          ],
        ),
        _SpendCompositionBar(slices: composition),
        const SizedBox(height: AppSpacing.s2),
        Text(
          _caption(),
          style: AppTypography.body(
            size: 12.5,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  String _caption() {
    final word = period == SpendPeriod.month ? 'last month' : 'last week';
    if (metrics.deltaPct == null) {
      return 'No spend recorded for the previous ${period == SpendPeriod.month ? 'month' : 'week'} yet.';
    }
    final dir = metrics.spendingDown ? 'less than' : 'more than';
    return '${formatMoney(currency, metrics.diff.abs())} $dir $word '
        '(${metrics.deltaPct!.abs().toStringAsFixed(1)}%).';
  }
}

class _PeriodToggle extends StatelessWidget {
  const _PeriodToggle({required this.period, required this.onPeriod});

  final SpendPeriod period;
  final ValueChanged<SpendPeriod> onPeriod;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.glassHighlight,
        border: Border.all(color: AppColors.glassBorder),
        borderRadius: BorderRadius.circular(11),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _seg('Month', SpendPeriod.month),
          _seg('Week', SpendPeriod.week),
        ],
      ),
    );
  }

  Widget _seg(String label, SpendPeriod value) {
    final on = period == value;
    return GestureDetector(
      onTap: () => onPeriod(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: on ? AppColors.brand : Colors.transparent,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Text(
          label,
          style: AppTypography.body(
            size: 11,
            weight: FontWeight.w600,
            color: on ? Colors.white : AppColors.textMuted,
          ),
        ),
      ),
    );
  }
}

/// Segmented spend-composition bar under the hero total (prototype 2a). Each
/// segment is one merchant's share of the period spend, colored by its brand;
/// widths sum to the hero total. Hidden when there's no spend — never faked.
class _SpendCompositionBar extends StatelessWidget {
  const _SpendCompositionBar({required this.slices});

  final List<SpendSlice> slices;

  @override
  Widget build(BuildContext context) {
    final total = slices.fold<double>(0, (sum, s) => sum + s.amount);
    if (slices.isEmpty || total <= 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: SizedBox(
          height: 6,
          child: Row(
            // Stretch so each segment fills the 6px height — a childless
            // ColoredBox under a Row's default (loose) constraints collapses to
            // zero height and the bar vanishes.
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final slice in slices)
                Expanded(
                  flex: (slice.amount / total * 1000).round().clamp(1, 1000),
                  child: ColoredBox(color: merchantColor(slice.merchant)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Inflation pulse (the signature 2a card): the caller's personal price index
// ---------------------------------------------------------------------------

class _InflationPulse extends StatelessWidget {
  const _InflationPulse({required this.insight});

  final InflationInsight? insight;

  @override
  Widget build(BuildContext context) {
    final data = insight;
    // No personal number yet: show an honest building-state card (rule #4 —
    // always state what fills the empty state), never a fabricated percentage.
    if (data == null || !data.hasPersonal) {
      return _InflationCardShell(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your inflation'.toUpperCase(),
              style: AppTypography.overline(size: 10.5),
            ),
            const SizedBox(height: 9),
            Text(
              'Building your personal inflation index',
              style: AppTypography.display(size: 17, weight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Scan a few more receipts of items you buy regularly and your '
              'own price index shows up here.',
              style: AppTypography.body(
                size: 11.5,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 13),
            const Divider(height: 1, color: AppColors.glassBorder),
            const SizedBox(height: 13),
            const _PriceReportLink(),
          ],
        ),
      );
    }

    final pct = data.personalInflationPct!;
    final rising = pct > 0;
    final color = rising ? AppColors.warning : AppColors.success;

    return _InflationCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your inflation'.toUpperCase(),
                      style: AppTypography.overline(size: 10.5),
                    ),
                    const SizedBox(height: 7),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${rising ? '+' : '−'}${pct.abs().toStringAsFixed(1)}%',
                          style: AppTypography.display(
                            size: 30,
                            weight: FontWeight.w800,
                            tabularNumbers: true,
                            color: color,
                          ),
                        ),
                        const SizedBox(width: 7),
                        Text(
                          'this quarter',
                          style: AppTypography.body(
                            size: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                    if (data.regionInflationPct != null) ...[
                      const SizedBox(height: 6),
                      _RegionRow(pct: data.regionInflationPct!),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.s3),
              InflationSparkline(trend: data.trend),
            ],
          ),
          const SizedBox(height: 13),
          const Divider(height: 1, color: AppColors.glassBorder),
          const SizedBox(height: 13),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(child: _InflationFooterText(insight: data)),
              const SizedBox(width: AppSpacing.s3),
              const _PriceReportLink(),
            ],
          ),
        ],
      ),
    );
  }
}

/// "● Region +6.8%" line under the personal number: a sign-toned dot + the region's index.
class _RegionRow extends StatelessWidget {
  const _RegionRow({required this.pct});

  final double pct;

  @override
  Widget build(BuildContext context) {
    final color = pct > 0 ? AppColors.warning : AppColors.success;
    return Row(
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          'Your region',
          style: AppTypography.body(
            size: 11.5,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          '${pct > 0 ? '+' : '−'}${pct.abs().toStringAsFixed(1)}%',
          style: AppTypography.display(
            size: 11.5,
            weight: FontWeight.w700,
            tabularNumbers: true,
            color: color,
          ),
        ),
      ],
    );
  }
}

/// Footer line: the savings headline when there's a real number, else the honest "keep scanning"
/// state — never a fabricated €0.
class _InflationFooterText extends StatelessWidget {
  const _InflationFooterText({required this.insight});

  final InflationInsight insight;

  @override
  Widget build(BuildContext context) {
    final saved = insight.savedBySwitching;
    if (saved != null && saved > 0) {
      return RichText(
        text: TextSpan(
          style: AppTypography.body(size: 12, color: AppColors.textSecondary),
          children: [
            TextSpan(
              text: '€${saved.toStringAsFixed(0)} saved',
              style: AppTypography.display(
                size: 12,
                weight: FontWeight.w700,
                tabularNumbers: true,
                color: AppColors.success,
              ),
            ),
            const TextSpan(text: ' this year buying below your region'),
          ],
        ),
      );
    }
    return Text(
      insight.regionInflationPct == null
          ? 'Regional comparison arrives as more shops are mapped.'
          : 'Every scan sharpens your price picture.',
      style: AppTypography.body(size: 12, color: AppColors.textMuted),
    );
  }
}

class _PriceReportLink extends StatelessWidget {
  const _PriceReportLink();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const ReportsScreen()),
      ),
      child: Text(
        'Price report →',
        style: AppTypography.body(
          size: 11.5,
          weight: FontWeight.w600,
          color: AppColors.brand,
        ),
      ),
    );
  }
}

/// Glow-card shell shared by the real inflation card and its building state:
/// glass-highlight tile, 18px radius, and the brand-glow corner bloom.
class _InflationCardShell extends StatelessWidget {
  const _InflationCardShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s5),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.glassHighlight,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Stack(
            children: [
              Positioned(
                top: -30,
                right: -20,
                child: Container(
                  width: 150,
                  height: 150,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [AppColors.brandGlow, Colors.transparent],
                      stops: [0.0, 0.7],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.s4),
                child: child,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Vs-last-period / Credits split row
// ---------------------------------------------------------------------------

class _MetricsSplitRow extends StatelessWidget {
  const _MetricsSplitRow({
    required this.metrics,
    required this.currency,
    required this.period,
    required this.usage,
  });

  final SpendMetrics metrics;
  final String currency;
  final SpendPeriod period;
  final UsageSummary? usage;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: AppColors.glassBorder),
          bottom: BorderSide(color: AppColors.glassBorder),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: _vsLastPeriod()),
          const SizedBox(width: AppSpacing.s4),
          Expanded(child: _credits()),
        ],
      ),
    );
  }

  Widget _vsLastPeriod() {
    final label =
        period == SpendPeriod.month ? 'Vs last month' : 'Vs last week';
    if (metrics.deltaPct == null) {
      return _metric(label, '—', 'No prior period');
    }
    final down = metrics.spendingDown;
    return _metric(
      label,
      '${down ? '↓' : '↑'} ${metrics.deltaPct!.abs().toStringAsFixed(1)}%',
      '${down ? '−' : '+'}${formatMoney(currency, metrics.diff.abs())} '
          'of ${formatMoney(currency, metrics.previous)}',
      valueColor: down ? AppColors.success : AppColors.warning,
    );
  }

  Widget _credits() {
    if (usage == null) return _metric('Credits left', '—', '');
    final u = usage!;
    final value = u.unlimited ? 'Unlimited' : '${u.remaining ?? 0}';
    final sub =
        u.unlimited ? 'No weekly limit' : '${u.used} of ${u.cap ?? 0} used';
    return _metric(
      'Credits left',
      value,
      sub,
      valueKey: const Key('usage-pill'),
    );
  }

  Widget _metric(
    String label,
    String value,
    String sub, {
    Color valueColor = AppColors.textPrimary,
    Key? valueKey,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label.toUpperCase(), style: AppTypography.overline(size: 10.5)),
          const SizedBox(height: AppSpacing.s2),
          Text(
            value,
            key: valueKey,
            style: AppTypography.display(
              size: 21,
              weight: FontWeight.w700,
              tabularNumbers: true,
              color: valueColor,
            ),
          ),
          if (sub.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              sub,
              style: AppTypography.body(size: 11, color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Category budgets preview (from BudgetBloc)
// ---------------------------------------------------------------------------

class _CategoryBudgets extends StatelessWidget {
  const _CategoryBudgets();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<BudgetBloc, BudgetState>(
      builder: (context, state) {
        if (state.status != BudgetStatus.ready || state.rows.isEmpty) {
          return const SizedBox.shrink();
        }
        final rows = [...state.rows]
          ..sort((a, b) => b.progressPct.compareTo(a.progressPct));
        final top = rows.take(3).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.s6),
            _SectionHeader(
              title: 'Category budgets',
              action: 'All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BudgetsScreen()),
              ),
            ),
            const SizedBox(height: AppSpacing.s3),
            for (final row in top) ...[
              _BudgetRow(row: row),
              if (row != top.last) const SizedBox(height: AppSpacing.s4),
            ],
          ],
        );
      },
    );
  }
}

class _BudgetRow extends StatelessWidget {
  const _BudgetRow({required this.row});

  final BudgetRowView row;

  @override
  Widget build(BuildContext context) {
    final pct = row.progressPct;
    final color = row.overCap ? AppColors.warning : AppColors.brand;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              row.categoryLabel,
              style: AppTypography.body(
                size: 13,
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              '${pct.round()}%',
              style: AppTypography.display(
                size: 12,
                weight: FontWeight.w700,
                tabularNumbers: true,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        // Prototype budget bars are brand (indigo) under cap, amber over — not
        // the success/warning/danger threshold scheme; match the `%` label.
        ProgressBar(
          value: pct,
          tone: row.overCap ? ProgressTone.warning : ProgressTone.brand,
          animate: true,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Recent invoices (ledger rows) — behavior unchanged from 16d/16e
// ---------------------------------------------------------------------------

class _RecentHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return _SectionHeader(
      title: 'Recent',
      action: 'See all',
      onAction: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const HistoryScreen()),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.action,
    required this.onAction,
  });

  final String title;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title.toUpperCase(), style: AppTypography.overline(size: 11)),
        GestureDetector(
          onTap: onAction,
          child: Text(
            action,
            style: AppTypography.body(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.brand,
            ),
          ),
        ),
      ],
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({required this.invoice});

  final InvoiceSummary invoice;

  Future<void> _pushReview(NavigatorState navigator, DashboardBloc bloc) async {
    final changed = await navigator.push<bool>(
      MaterialPageRoute(builder: (_) => ReviewScreen(invoiceId: invoice.id)),
    );
    if (changed == true) bloc.add(const DashboardRefreshed());
  }

  @override
  Widget build(BuildContext context) {
    final view = invoice.statusView;
    return Container(
      key: Key('invoice-card-${invoice.id}'),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: InkWell(
        onTap: () =>
            _pushReview(Navigator.of(context), context.read<DashboardBloc>()),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.s5,
            vertical: 13,
          ),
          child: Row(
            children: [
              _StatusDot(merchant: invoice.merchant, tone: view.tone),
              const SizedBox(width: AppSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invoice.merchant,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 14,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${formatShortDate(invoice.dateIso)} · ${view.label}',
                      style: AppTypography.body(
                        size: 11,
                        color: _subColor(view.tone),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.s2),
              Text(
                formatMoney(invoice.currency, invoice.total),
                style: AppTypography.display(
                  size: 14.5,
                  weight: FontWeight.w700,
                  tabularNumbers: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Color _subColor(StatusTone tone) => switch (tone) {
        StatusTone.warning => AppColors.warning,
        StatusTone.danger => AppColors.danger,
        _ => AppColors.textMuted,
      };
}

/// The ledger row's leading dot: status tone when it demands attention
/// (processing/warning/danger), else the merchant's brand color (17d).
class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.merchant, required this.tone});

  final String merchant;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      StatusTone.processing => AppColors.brand,
      StatusTone.warning => AppColors.warning,
      StatusTone.danger => AppColors.danger,
      StatusTone.success => merchantColor(merchant),
    };
    return Container(
      key: const Key('status-pill'),
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.brandGlow,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.receipt,
                size: 28,
                color: AppColors.brand,
              ),
            ),
            const SizedBox(height: AppSpacing.s4),
            Text(
              'No receipts yet',
              style: AppTypography.display(size: 17, weight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              'Tap the camera to add your first one',
              style: AppTypography.body(size: 13, color: AppColors.textMuted),
            ),
          ],
        ),
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
            'Couldn’t load your receipts',
            style: AppTypography.body(size: 15),
          ),
          const SizedBox(height: AppSpacing.s3),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
