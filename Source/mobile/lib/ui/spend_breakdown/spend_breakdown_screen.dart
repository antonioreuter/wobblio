import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/spend_breakdown/spend_breakdown_bloc.dart';
import 'package:wobblio/core/ports/spend_report_repository.dart';
import 'package:wobblio/core/reports/spend_breakdown.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/format.dart';

/// Spend Breakdown screen: a drill from category → merchant → item-category →
/// items, mirroring the web `/spend` page. Category + merchant levels are open
/// to every tier; the item levels are premium (fail-closed gate in the bloc,
/// upsell card here). Pushed via `Navigator` from the Reports tab. Widgets are
/// logic-free — all state lives in [SpendBreakdownBloc].
class SpendBreakdownScreen extends StatelessWidget {
  const SpendBreakdownScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SpendBreakdownBloc>(
      create: (_) =>
          locator<SpendBreakdownBloc>()..add(const SpendBreakdownStarted()),
      child: const _SpendView(),
    );
  }
}

class _SpendView extends StatelessWidget {
  const _SpendView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('spend-breakdown-screen'),
      backgroundColor: Colors.transparent,
      appBar: WobblioHeaderBar(
        title: 'Spend breakdown',
        onBack: () => Navigator.of(context).maybePop(),
      ),
      body: SafeArea(
        child: BlocBuilder<SpendBreakdownBloc, SpendBreakdownState>(
          builder: (context, state) {
            final bloc = context.read<SpendBreakdownBloc>();
            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PeriodSelector(
                    period: state.period,
                    onChanged: (p) => bloc.add(SpendBreakdownPeriodChanged(p)),
                  ),
                  const SizedBox(height: 10),
                  _RegionToggle(
                    allRegions: state.allRegions,
                    onChanged: (all) =>
                        bloc.add(SpendBreakdownRegionScopeChanged(all)),
                  ),
                  const SizedBox(height: 16),
                  _Breadcrumb(
                    state: state,
                    onTap: (d) => bloc.add(SpendBreakdownCrumbTapped(d)),
                  ),
                  const SizedBox(height: 12),
                  if (state.showUpsell)
                    _UpsellCard(
                      onDismiss: () =>
                          bloc.add(const SpendBreakdownUpsellDismissed()),
                    ),
                  _Content(state: state, bloc: bloc),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state, required this.bloc});

  final SpendBreakdownState state;
  final SpendBreakdownBloc bloc;

  @override
  Widget build(BuildContext context) {
    if (state.status == SpendBreakdownStatus.loading &&
        state.breakdown == null) {
      return const Padding(
        padding: EdgeInsets.only(top: 48),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.status == SpendBreakdownStatus.forbidden) {
      return const _UpsellCard(onDismiss: null);
    }
    if (state.status == SpendBreakdownStatus.failure) {
      return _Message(
        text: 'Couldn’t load this breakdown.',
        actionLabel: 'Retry',
        onAction: () => bloc.add(const SpendBreakdownReloaded()),
      );
    }
    final breakdown = state.breakdown;
    if (breakdown == null || breakdown.nodes.isEmpty) {
      return const _Message(
        text: 'No spend in this period — try a wider range or “All regions”.',
      );
    }

    if (breakdown.level == SpendLevel.items) {
      return Column(
        children: breakdown.nodes
            .map((n) => _ItemTile(node: n, currency: breakdown.currency))
            .toList(),
      );
    }

    final locked = breakdown.level == SpendLevel.merchants && !state.isPremium;
    // Rows are inert while a fetch is in flight so a tap on the still-visible previous level's
    // bars can't be re-interpreted at the new (already-advanced) selection level.
    final isLoading = state.status == SpendBreakdownStatus.loading;
    final maxAbs = breakdown.nodes
        .map((n) => n.amount.abs())
        .fold<double>(0, (a, b) => a > b ? a : b);
    return Column(
      children: [
        _TotalHeader(total: breakdown.total, currency: breakdown.currency),
        const SizedBox(height: 8),
        ...breakdown.nodes.map(
          (n) => _SpendBar(
            node: n,
            currency: breakdown.currency,
            level: breakdown.level,
            maxAbs: maxAbs,
            locked: locked,
            onTap:
                isLoading ? null : () => bloc.add(SpendBreakdownDrilledInto(n)),
          ),
        ),
      ],
    );
  }
}

String _money(String? currency, double value) =>
    currency == null ? value.toStringAsFixed(2) : formatMoney(currency, value);

class _TotalHeader extends StatelessWidget {
  const _TotalHeader({required this.total, required this.currency});
  final double total;
  final String? currency;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Total',
          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
        ),
        Text(
          _money(currency, total),
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _SpendBar extends StatelessWidget {
  const _SpendBar({
    required this.node,
    required this.currency,
    required this.level,
    required this.maxAbs,
    required this.locked,
    required this.onTap,
  });

  final SpendNode node;
  final String? currency;
  final SpendLevel level;
  final double maxAbs;
  final bool locked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final negative = node.amount < 0;
    final fraction =
        maxAbs > 0 ? (node.amount.abs() / maxAbs).clamp(0.0, 1.0) : 0.0;
    final barColor = negative ? AppColors.success : AppColors.brand;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        child: GlassContainer(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          borderRadius: AppSpacing.radiusLg,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      node.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Text(
                    _money(currency, node.amount),
                    style: TextStyle(
                      color:
                          negative ? AppColors.success : AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (locked)
                    const Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: Icon(Icons.lock, size: 15, color: AppColors.brand),
                    )
                  else
                    const Padding(
                      padding: EdgeInsets.only(left: 4),
                      child: Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                child: Container(
                  height: 6,
                  color: AppColors.glassBorder,
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: fraction,
                    child: Container(color: barColor),
                  ),
                ),
              ),
              const SizedBox(height: 5),
              Text(
                _meta(),
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _meta() {
    final pct = '${node.pct.toStringAsFixed(1)}%';
    if (level == SpendLevel.merchants && node.invoiceCount != null) {
      final n = node.invoiceCount!;
      return '$pct · $n invoice${n == 1 ? '' : 's'}';
    }
    return pct;
  }
}

class _ItemTile extends StatefulWidget {
  const _ItemTile({required this.node, required this.currency});
  final SpendNode node;
  final String? currency;

  @override
  State<_ItemTile> createState() => _ItemTileState();
}

class _ItemTileState extends State<_ItemTile> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    final expandable = node.occurrences.length > 1;
    final qty = formatQuantity(node.quantity ?? 0);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassContainer(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        borderRadius: AppSpacing.radiusLg,
        child: Column(
          children: [
            InkWell(
              onTap: expandable ? () => setState(() => _open = !_open) : null,
              child: Row(
                children: [
                  if (expandable)
                    Icon(
                      _open ? Icons.expand_more : Icons.chevron_right,
                      size: 18,
                      color: AppColors.textMuted,
                    )
                  else
                    const SizedBox(width: 18),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      node.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Text(
                    '×$qty',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    _money(widget.currency, node.amount),
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            if (_open)
              Padding(
                padding: const EdgeInsets.only(top: 8, left: 22),
                child: Column(
                  children: node.occurrences
                      .map(
                        (o) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            children: [
                              Text(
                                formatShortDate(o.date),
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                '×${formatQuantity(o.quantity)}',
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                _money(widget.currency, o.amount),
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PeriodSelector extends StatelessWidget {
  const _PeriodSelector({required this.period, required this.onChanged});
  final SpendPeriod period;
  final ValueChanged<SpendPeriod> onChanged;

  static const _options = [
    (SpendPeriod.thisWeek, 'This week'),
    (SpendPeriod.thisMonth, 'This month'),
    (SpendPeriod.last90d, 'Last 3 months'),
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: _options
          .map(
            (o) => _Chip(
              label: o.$2,
              active: period == o.$1,
              onTap: () => onChanged(o.$1),
            ),
          )
          .toList(),
    );
  }
}

class _RegionToggle extends StatelessWidget {
  const _RegionToggle({required this.allRegions, required this.onChanged});
  final bool allRegions;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        _Chip(
          label: 'My region',
          active: !allRegions,
          onTap: () => onChanged(false),
        ),
        _Chip(
          label: 'All regions',
          active: allRegions,
          onTap: () => onChanged(true),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.brandGlow : AppColors.glassBg,
          borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
          border: Border.all(
            color: active ? AppColors.brand : AppColors.glassBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? AppColors.textPrimary : AppColors.textSecondary,
            fontSize: 13,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({required this.state, required this.onTap});
  final SpendBreakdownState state;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final crumbs = <(String, int)>[('All spend', 0)];
    if (state.categoryId != null) {
      crumbs.add((state.categoryName ?? 'Category', 1));
    }
    if (state.merchantId != null) {
      crumbs.add((state.merchantName ?? 'Merchant', 2));
    }
    if (state.itemCategoryId != null) {
      crumbs.add((state.itemCategoryName ?? 'Items', 3));
    }

    final children = <Widget>[];
    for (var i = 0; i < crumbs.length; i++) {
      final isLast = i == crumbs.length - 1;
      final (label, depth) = crumbs[i];
      children.add(
        isLast
            ? Text(
                label,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              )
            : GestureDetector(
                onTap: () => onTap(depth),
                child: Text(
                  label,
                  style: const TextStyle(color: AppColors.brand, fontSize: 13),
                ),
              ),
      );
      if (!isLast) {
        children.add(
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 6),
            child:
                Icon(Icons.chevron_right, size: 14, color: AppColors.textMuted),
          ),
        );
      }
    }
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: children,
    );
  }
}

class _UpsellCard extends StatelessWidget {
  const _UpsellCard({required this.onDismiss});
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassContainer(
        borderColor: AppColors.brandBorder,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.workspace_premium, size: 20, color: AppColors.brand),
                SizedBox(width: 8),
                Text(
                  'See the actual items with Premium',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Category and merchant breakdowns are on every plan. Premium unlocks the item '
              'categories inside each merchant and the individual products you bought. Manage '
              'your plan in the web app.',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            if (onDismiss != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onDismiss,
                  child: const Text('Dismiss'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, this.actionLabel, this.onAction});
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Center(
        child: Column(
          children: [
            Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textMuted),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ),
      ),
    );
  }
}
