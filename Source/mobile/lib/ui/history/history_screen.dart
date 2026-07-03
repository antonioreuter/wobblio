import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/history/history_bloc.dart';
import 'package:wobblio/core/ingestion/invoice_status.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/merchant_icon.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';
import 'package:wobblio/ui/invoice_detail/invoice_detail_screen.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Full receipts list (18b): search + month-grouped ledger rows over the same
/// invoice list Dashboard already loads. Row tap opens [InvoiceDetailScreen].
class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<HistoryBloc>(
      create: (_) => locator<HistoryBloc>()..add(const HistoryStarted()),
      child: const _HistoryView(),
    );
  }
}

class _HistoryView extends StatelessWidget {
  const _HistoryView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('history-screen'),
      body: SafeArea(
        child: BlocConsumer<HistoryBloc, HistoryState>(
          listenWhen: (prev, curr) =>
              curr.notice != null && prev.notice != curr.notice,
          listener: (context, state) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          },
          builder: (context, state) {
            if (state.status == HistoryStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == HistoryStatus.failure) {
              return _RetryMessage(
                onRetry: () =>
                    context.read<HistoryBloc>().add(const HistoryStarted()),
              );
            }
            return RefreshIndicator(
              onRefresh: () {
                final bloc = context.read<HistoryBloc>();
                bloc.add(const HistoryRefreshed());
                return bloc.stream.firstWhere((s) => !s.isRefreshing);
              },
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    sliver: SliverToBoxAdapter(child: _Header(state: state)),
                  ),
                  if (state.monthGroups.isEmpty)
                    const SliverFillRemaining(
                        hasScrollBody: false, child: _EmptyState(),)
                  else
                    for (final group in state.monthGroups) ...[
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                        sliver: SliverToBoxAdapter(
                          child: Text(group.label.toUpperCase(),
                              style: AppTypography.overline(),),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        sliver: SliverList.builder(
                          itemCount: group.invoices.length,
                          itemBuilder: (context, i) =>
                              _LedgerRow(invoice: group.invoices[i]),
                        ),
                      ),
                    ],
                  const SliverPadding(padding: EdgeInsets.only(bottom: 16)),
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

  final HistoryState state;

  @override
  Widget build(BuildContext context) {
    final subtitle = '${state.scannedCount} scanned'
        '${state.totalThisMonth > 0 ? ' · ${formatMoney(state.thisMonthCurrency, state.totalThisMonth)} this month' : ''}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Receipts',
            style: AppTypography.display(size: AppTypography.text2xl),),
        const SizedBox(height: 2),
        Text(subtitle,
            style: AppTypography.body(
                size: AppTypography.textXs, color: AppColors.textMuted,),),
        const SizedBox(height: 16),
        TextField(
          key: const Key('history-search'),
          onChanged: (q) =>
              context.read<HistoryBloc>().add(HistorySearchChanged(q)),
          style: AppTypography.body(size: AppTypography.textSm),
          decoration: InputDecoration(
            hintText: 'Search merchant, tag…',
            hintStyle: AppTypography.body(
                size: AppTypography.textSm, color: AppColors.textMuted,),
            prefixIcon:
                const Icon(Icons.search, size: 18, color: AppColors.textMuted),
            filled: true,
            fillColor: AppColors.glassHighlight,
            isDense: true,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              borderSide: const BorderSide(color: AppColors.glassBorder),
            ),
          ),
        ),
      ],
    );
  }
}

class _LedgerRow extends StatelessWidget {
  const _LedgerRow({required this.invoice});

  final InvoiceSummary invoice;

  @override
  Widget build(BuildContext context) {
    final view = invoice.statusView;
    final dotColor =
        view.tone == StatusTone.processing || view.tone == StatusTone.success
            ? merchantColor(invoice.merchant)
            : _toneColor(view.tone);
    return InkWell(
      key: Key('history-row-${invoice.id}'),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) => InvoiceDetailScreen(invoiceId: invoice.id),),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
        ),
        child: Row(
          children: [
            Container(
              width: 7,
              height: 7,
              decoration:
                  BoxDecoration(color: dotColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    invoice.merchant,
                    style: AppTypography.body(
                        size: AppTypography.textSm, weight: FontWeight.w600,),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${invoice.dateIso}${view.tone == StatusTone.warning ? ' · ${view.label}' : ''}',
                    style: AppTypography.body(
                      size: AppTypography.textXs,
                      color: view.tone == StatusTone.warning
                          ? AppColors.warning
                          : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              formatMoney(invoice.currency, invoice.total),
              style: AppTheme.money,
            ),
          ],
        ),
      ),
    );
  }

  static Color _toneColor(StatusTone tone) => switch (tone) {
        StatusTone.processing => AppColors.brand,
        StatusTone.success => AppColors.success,
        StatusTone.warning => AppColors.warning,
        StatusTone.danger => AppColors.danger,
      };
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.receipt_long, size: 48, color: AppColors.brand),
          const SizedBox(height: 16),
          Text('No receipts yet',
              style: AppTypography.body(size: AppTypography.textMd),),
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
          Text('Couldn’t load your receipts',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
