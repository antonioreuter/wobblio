import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/invoice_detail/invoice_detail_bloc.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_status.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/badge.dart';
import 'package:wobblio/ui/design_system/button.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/merchant_icon.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';
import 'package:wobblio/ui/split_bill/split_bill_screen.dart';

/// Read-only single-invoice view (18b): header, info rows, line items,
/// feedback, Share, Split bill + Delete. The Split bill button is always
/// visible and always navigates to [SplitBillScreen] — that screen owns the
/// Premium upsell in place, rather than this one hiding/disabling the entry
/// point (18h; see `specs/mvp/18-mobile-navigation-and-lists/18h-split-bill.md`).
class InvoiceDetailScreen extends StatelessWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<InvoiceDetailBloc>(
      create: (_) => locator<InvoiceDetailBloc>(param1: invoiceId)
        ..add(const InvoiceDetailStarted()),
      child: const _InvoiceDetailView(),
    );
  }
}

class _InvoiceDetailView extends StatelessWidget {
  const _InvoiceDetailView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('invoice-detail-screen'),
      backgroundColor: Colors.transparent,
      appBar: WobblioHeaderBar(
        title: 'Invoice',
        onBack: () => Navigator.of(context).maybePop(),
      ),
      body: BlocConsumer<InvoiceDetailBloc, InvoiceDetailState>(
        listenWhen: (prev, curr) =>
            (curr.notice != null && prev.notice != curr.notice) || curr.deleted,
        listener: (context, state) {
          if (state.notice != null) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          }
          if (state.deleted && context.mounted) {
            Navigator.of(context).pop(true);
          }
        },
        builder: (context, state) {
          if (state.status == InvoiceDetailStatus.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          final detail = state.detail;
          if (state.status == InvoiceDetailStatus.failure || detail == null) {
            return _RetryMessage(
              onRetry: () => context
                  .read<InvoiceDetailBloc>()
                  .add(const InvoiceDetailStarted()),
            );
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _HeaderCard(detail: detail),
                const SizedBox(height: 16),
                _InfoRows(detail: detail),
                const SizedBox(height: 16),
                if (detail.imageUrl != null)
                  SizedBox(
                    width: double.infinity,
                    child: WobblioButton(
                      label: 'View original receipt',
                      variant: WobblioButtonVariant.outline,
                      iconLeft: Icons.image_outlined,
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) =>
                                _PhotoViewer(imageUrl: detail.imageUrl!),),
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                _LineItems(detail: detail),
                const SizedBox(height: 16),
                _FeedbackRow(
                  verdict: state.feedbackVerdict,
                  onRate: (v) => context
                      .read<InvoiceDetailBloc>()
                      .add(InvoiceDetailFeedbackSubmitted(v)),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: WobblioButton(
                        key: const Key('invoice-detail-split-bill'),
                        label: 'Split bill',
                        variant: WobblioButtonVariant.outline,
                        iconLeft: Icons.groups_outlined,
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) =>
                                  SplitBillScreen(invoiceId: detail.id),),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: WobblioButton(
                        key: const Key('invoice-detail-share'),
                        label: 'Share',
                        variant: WobblioButtonVariant.primary,
                        iconLeft: Icons.share,
                        onPressed: () => context
                            .read<InvoiceDetailBloc>()
                            .add(const InvoiceDetailShareRequested()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Center(
                  child: WobblioButton(
                    key: const Key('invoice-detail-delete'),
                    label: 'Delete invoice',
                    variant: WobblioButtonVariant.text,
                    foregroundColor: AppColors.danger,
                    iconLeft: Icons.delete_outline,
                    busy: state.isDeleting,
                    onPressed: () => _confirmDelete(context),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final bloc = context.read<InvoiceDetailBloc>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete this receipt?'),
        content: const Text('This can’t be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child:
                const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (confirmed == true) bloc.add(const InvoiceDetailDeleteRequested());
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.detail});

  final InvoiceDetail detail;

  @override
  Widget build(BuildContext context) {
    final view =
        statusViewFor(detail.status, processingStage: detail.processingStage);
    return GlassContainer(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MerchantIcon(merchant: detail.merchant, size: 46),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  detail.merchant,
                  style: AppTypography.display(
                      size: 16, weight: FontWeight.w700,),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              WobblioBadge(label: view.label, tone: _badgeTone(view.tone)),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Divider(height: 1, color: AppColors.glassBorder),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('TOTAL', style: AppTypography.overline()),
              Text(
                formatMoney(detail.currency, detail.total ?? 0),
                style: AppTypography.display(
                    size: 26,
                    weight: FontWeight.w800,
                    tabularNumbers: true,),
              ),
            ],
          ),
          // §11 FX: for a foreign receipt, show the total in the viewer's home
          // currency plus the exchange rate used — line items stay in the
          // receipt's original currency (Option 1).
          if (detail.showsCurrencyConversion) ...[
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('IN ${detail.homeCurrency}',
                    style: AppTypography.overline(),),
                Text(
                  '≈ ${formatMoney(detail.homeCurrency!, detail.totalHomeCurrency!)}',
                  style: AppTypography.body(
                      size: 16,
                      weight: FontWeight.w700,
                      color: AppColors.textSecondary,),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                detail.exchangeRateLabel ?? '',
                style: AppTypography.body(
                    size: 12, color: AppColors.textMuted,),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static WobblioBadgeTone _badgeTone(StatusTone tone) => switch (tone) {
        StatusTone.processing => WobblioBadgeTone.primary,
        StatusTone.success => WobblioBadgeTone.success,
        StatusTone.warning => WobblioBadgeTone.warning,
        StatusTone.danger => WobblioBadgeTone.danger,
      };
}

class _InfoRows extends StatelessWidget {
  const _InfoRows({required this.detail});

  final InvoiceDetail detail;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      if (detail.transactionDate != null)
        ('Date', formatMediumDate(detail.transactionDate!)),
      if (detail.locationLabel != null) ('Location', detail.locationLabel!),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              border: Border(
                top: i == 0
                    ? const BorderSide(color: AppColors.glassBorder)
                    : BorderSide.none,
                bottom: i < rows.length - 1
                    ? const BorderSide(color: AppColors.glassBorder)
                    : BorderSide.none,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(rows[i].$1,
                    style: AppTypography.body(
                        size: AppTypography.textSm,
                        color: AppColors.textMuted,),),
                // The Date value uses the mono-tabular display face (matching the
                // prototype's monospaced date); text values keep the body face.
                Text(
                  rows[i].$2,
                  style: rows[i].$1 == 'Date'
                      ? AppTypography.display(
                          size: AppTypography.textSm,
                          weight: FontWeight.w600,
                          color: AppColors.textSecondary,
                          tabularNumbers: true,)
                      : AppTypography.body(
                          size: AppTypography.textSm,
                          weight: FontWeight.w600,
                          color: AppColors.textSecondary,),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _LineItems extends StatelessWidget {
  const _LineItems({required this.detail});

  final InvoiceDetail detail;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('LINE ITEMS · ${detail.lines.length}',
            style: AppTypography.overline(),),
        const SizedBox(height: 8),
        for (var i = 0; i < detail.lines.length; i++)
          Container(
            key: Key('invoice-detail-line-${detail.lines[i].id}'),
            padding: const EdgeInsets.symmetric(vertical: 11),
            decoration: BoxDecoration(
              border: Border(
                top: i == 0
                    ? const BorderSide(color: AppColors.glassBorder)
                    : BorderSide.none,
                bottom: i < detail.lines.length - 1
                    ? const BorderSide(color: AppColors.glassBorder)
                    : BorderSide.none,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        detail.lines[i].rawText,
                        style: AppTypography.body(
                            size: AppTypography.textSm,
                            weight: FontWeight.w500,),
                      ),
                      if (detail.lines[i].categoryName != null)
                        Text(
                          detail.lines[i].categoryName!,
                          style: AppTypography.body(
                              size: AppTypography.textXs,
                              color: AppColors.textMuted,),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '×${formatQuantity(detail.lines[i].quantity)}',
                  style: AppTypography.display(
                      size: AppTypography.textXs,
                      weight: FontWeight.w600,
                      color: AppColors.textMuted,
                      tabularNumbers: true,),
                ),
                const SizedBox(width: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 52),
                  child: Text(
                    formatMoney(detail.currency, detail.lines[i].lineTotal),
                    textAlign: TextAlign.right,
                    style: AppTypography.display(
                        size: AppTypography.textSm,
                        weight: FontWeight.w700,
                        tabularNumbers: true,),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _FeedbackRow extends StatelessWidget {
  const _FeedbackRow({required this.verdict, required this.onRate});

  final FeedbackVerdict? verdict;
  final ValueChanged<FeedbackVerdict> onRate;

  @override
  Widget build(BuildContext context) {
    final rated = verdict != null;
    return GlassContainer(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rated
                      ? 'Thanks — that trains the scanner.'
                      : 'Was this parsed correctly?',
                  style: AppTypography.body(
                      size: AppTypography.textSm, weight: FontWeight.w600,),
                ),
                if (!rated) ...[
                  const SizedBox(height: 2),
                  Text('A quick rating trains the scanner.',
                      style: AppTypography.body(
                          size: AppTypography.text2xs,
                          color: AppColors.textMuted,),),
                ],
              ],
            ),
          ),
          IconButton(
            key: const Key('invoice-detail-feedback-up'),
            isSelected: verdict == FeedbackVerdict.up,
            onPressed: () => onRate(FeedbackVerdict.up),
            icon: const Icon(Icons.thumb_up_outlined),
            selectedIcon: const Icon(Icons.thumb_up, color: AppColors.success),
          ),
          IconButton(
            key: const Key('invoice-detail-feedback-down'),
            isSelected: verdict == FeedbackVerdict.down,
            onPressed: () => onRate(FeedbackVerdict.down),
            icon: const Icon(Icons.thumb_down_outlined),
            selectedIcon:
                const Icon(Icons.thumb_down, color: AppColors.warning),
          ),
        ],
      ),
    );
  }
}

class _PhotoViewer extends StatelessWidget {
  const _PhotoViewer({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      // Frame the receipt against the whole screen, including behind the
      // translucent app bar, so tall/large invoices are fully visible.
      extendBodyBehindAppBar: true,
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: InteractiveViewer(
        key: const Key('invoice-detail-photo'),
        minScale: 1,
        maxScale: 5,
        // BoxFit.contain scales the whole invoice down to fit the viewport;
        // pinch-zoom then magnifies for reading detail.
        child: SizedBox.expand(
          child: Image.network(
            imageUrl,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Center(
              child: Icon(
                Icons.broken_image_outlined,
                color: Colors.white54,
                size: 48,
              ),
            ),
          ),
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
          Text('Couldn’t load this receipt',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
