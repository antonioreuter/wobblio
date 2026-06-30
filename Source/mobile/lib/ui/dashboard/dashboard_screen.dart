import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/dashboard/dashboard_bloc.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_status.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ingestion/usage_summary.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/capture/capture_screen.dart';
import 'package:wobblio/ui/format.dart';
import 'package:wobblio/ui/review/review_screen.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Mobile home (16d): recent invoices with live status pills, pull-to-refresh,
/// terminal-status polling, accuracy thumbs, and a tag-filter chip row. The
/// [DashboardBloc] is created here and started immediately.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<DashboardBloc>(
      create: (_) => locator<DashboardBloc>()..add(const DashboardStarted()),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  Future<void> _openCapture(BuildContext context) async {
    final bloc = context.read<DashboardBloc>();
    final invoiceId = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const CaptureScreen()),
    );
    if (invoiceId == null) return;
    // A capture inserted a PROCESSING row — refresh + poll it to terminal.
    bloc.add(const DashboardRefreshed());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('dashboard-screen'),
      appBar: AppBar(
        title: const Text('Receipts'),
        actions: const [_UsagePill(), SizedBox(width: 12)],
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('capture-fab'),
        onPressed: () => _openCapture(context),
        icon: const Icon(Icons.photo_camera),
        label: const Text('Scan receipt'),
      ),
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
            // Keep the spinner up until the refresh actually completes (the bloc
            // flips isRefreshing back off on success or failure).
            onRefresh: () {
              final bloc = context.read<DashboardBloc>();
              bloc.add(const DashboardRefreshed());
              return bloc.stream.firstWhere((s) => !s.isRefreshing);
            },
            child: _InvoiceList(state: state),
          );
        },
      ),
    );
  }
}

class _InvoiceList extends StatelessWidget {
  const _InvoiceList({required this.state});

  final DashboardState state;

  @override
  Widget build(BuildContext context) {
    final invoices = state.visibleInvoices;
    return CustomScrollView(
      // Always scrollable so pull-to-refresh works even when the list is short.
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        if (state.availableTags.isNotEmpty)
          SliverToBoxAdapter(
            child: _TagFilterRow(
              tags: state.availableTags,
              selected: state.selectedTag,
            ),
          ),
        if (invoices.isEmpty)
          const SliverFillRemaining(hasScrollBody: false, child: _EmptyState())
        else
          SliverList.builder(
            itemCount: invoices.length,
            itemBuilder: (context, i) => _InvoiceCard(
              invoice: invoices[i],
              verdict: state.feedback[invoices[i].id],
            ),
          ),
      ],
    );
  }
}

class _TagFilterRow extends StatelessWidget {
  const _TagFilterRow({required this.tags, required this.selected});

  final List<String> tags;
  final String? selected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        key: const Key('tag-filter-row'),
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: tags.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final tag = tags[i];
          return ChoiceChip(
            label: Text(tag),
            selected: selected == tag,
            onSelected: (_) =>
                context.read<DashboardBloc>().add(DashboardTagSelected(tag)),
          );
        },
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice, required this.verdict});

  final InvoiceSummary invoice;
  final FeedbackVerdict? verdict;

  void _openReview(BuildContext context) =>
      _pushReview(Navigator.of(context), context.read<DashboardBloc>());

  // Opens the correction screen; refreshes the list when it reports a change
  // (corrected → PARSED, or discarded) so the row reflects the new state.
  Future<void> _pushReview(NavigatorState navigator, DashboardBloc bloc) async {
    final changed = await navigator.push<bool>(
      MaterialPageRoute(builder: (_) => ReviewScreen(invoiceId: invoice.id)),
    );
    if (changed == true) bloc.add(const DashboardRefreshed());
  }

  void _rate(BuildContext context, FeedbackVerdict v) {
    final bloc = context.read<DashboardBloc>();
    bloc.add(DashboardFeedbackSubmitted(invoice.id, v));
    if (v != FeedbackVerdict.down) return;
    // Thumbs-down: offer the shortcut into the correction screen (16e). Capture
    // the navigator/bloc now — the card's context may be defunct (list rebuilt by
    // a poll) by the time the snackbar action fires.
    final navigator = Navigator.of(context);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: const Text('Thanks — want to fix the details?'),
          action: SnackBarAction(
            label: 'Fix details',
            onPressed: () => _pushReview(navigator, bloc),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('invoice-card-${invoice.id}'),
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: InkWell(
        onTap: () => _openReview(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.brand,
                    child: Text(
                      _initial(invoice.merchant),
                      style: const TextStyle(color: AppColors.textPrimary),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      invoice.merchant,
                      style: Theme.of(context).textTheme.bodyLarge,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(formatMoney(invoice.currency, invoice.total), style: AppTheme.money),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    invoice.dateIso,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const Spacer(),
                  _StatusPill(view: invoice.statusView),
                ],
              ),
              if (invoice.tags.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    for (final tag in invoice.tags)
                      Chip(
                        label: Text(tag),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ],
              if (!invoice.isProcessing)
                _FeedbackRow(
                  verdict: verdict,
                  onRate: (v) => _rate(context, v),
                ),
            ],
          ),
        ),
      ),
    );
  }

  static String _initial(String merchant) =>
      merchant.trim().isEmpty ? '?' : merchant.trim()[0].toUpperCase();
}

class _FeedbackRow extends StatelessWidget {
  const _FeedbackRow({required this.verdict, required this.onRate});

  final FeedbackVerdict? verdict;
  final ValueChanged<FeedbackVerdict> onRate;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        IconButton(
          key: const Key('feedback-up'),
          tooltip: 'Looks right',
          isSelected: verdict == FeedbackVerdict.up,
          onPressed: () => onRate(FeedbackVerdict.up),
          icon: const Icon(Icons.thumb_up_outlined),
          selectedIcon: const Icon(Icons.thumb_up, color: AppColors.success),
        ),
        IconButton(
          key: const Key('feedback-down'),
          tooltip: 'Something’s off',
          isSelected: verdict == FeedbackVerdict.down,
          onPressed: () => onRate(FeedbackVerdict.down),
          icon: const Icon(Icons.thumb_down_outlined),
          selectedIcon: const Icon(Icons.thumb_down, color: AppColors.warning),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.view});

  final InvoiceStatusView view;

  @override
  Widget build(BuildContext context) {
    final color = _toneColor(view.tone);
    return Container(
      key: const Key('status-pill'),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (view.tone == StatusTone.processing)
            const SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Icon(_toneIcon(view.tone), size: 13, color: color),
          const SizedBox(width: 6),
          Text(view.label, style: TextStyle(color: color, fontSize: 12)),
        ],
      ),
    );
  }

  static Color _toneColor(StatusTone tone) => switch (tone) {
        StatusTone.processing => AppColors.brand,
        StatusTone.success => AppColors.success,
        StatusTone.warning => AppColors.warning,
        StatusTone.danger => AppColors.danger,
      };

  static IconData _toneIcon(StatusTone tone) => switch (tone) {
        StatusTone.processing => Icons.hourglass_top,
        StatusTone.success => Icons.check_circle,
        StatusTone.warning => Icons.error_outline,
        StatusTone.danger => Icons.cancel,
      };
}

class _UsagePill extends StatelessWidget {
  const _UsagePill();

  @override
  Widget build(BuildContext context) {
    final usage =
        context.select<DashboardBloc, UsageSummary?>((b) => b.state.usage);
    if (usage == null) return const SizedBox.shrink();
    final label =
        usage.unlimited ? 'Unlimited' : '${usage.remaining ?? 0} left';
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Text(
          label,
          key: const Key('usage-pill'),
          style: Theme.of(context).textTheme.labelSmall,
        ),
      ),
    );
  }
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
          Text('No receipts yet', style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 4),
          Text(
            'Tap Scan to add your first one',
            style: Theme.of(context).textTheme.bodyMedium,
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
            'Couldn’t load your receipts',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
