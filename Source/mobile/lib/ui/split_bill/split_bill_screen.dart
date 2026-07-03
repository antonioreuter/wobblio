import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/split_bill/split_bill_bloc.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/splitting/split_summary.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/avatar.dart';
import 'package:wobblio/ui/design_system/button.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/input.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';

/// Split Bill screen (18h): non-premium accounts see an in-place upsell card
/// (the entry point on `InvoiceDetailScreen` is always visible — the upsell
/// lives here, not as a hidden affordance, mirroring the webapp's
/// `bill-split-dialog.tsx`). Premium accounts get the full tap-to-assign
/// flow: people chips, assignable line rows, per-person summary, WhatsApp
/// share/copy. See
/// `specs/mvp/18-mobile-navigation-and-lists/18h-split-bill.md`.
class SplitBillScreen extends StatelessWidget {
  const SplitBillScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SplitBillBloc>(
      create: (_) => locator<SplitBillBloc>(param1: invoiceId)
        ..add(const SplitBillStarted()),
      child: const _SplitBillView(),
    );
  }
}

// ── Palette ──────────────────────────────────────────────────────────────
// Mirrors the webapp's `SERIES_COLORS`/`seriesColor` (trend-data.ts): "You"
// always gets a fixed color (index 0); named participants rotate through the
// rest by their index in `state.participants`.
const List<Color> _kSplitPalette = [
  Color(0xFF6366F1), // indigo — You
  Color(0xFF0D9488), // teal
  Color(0xFFF59E0B), // amber
  Color(0xFFF43F5E), // rose
  Color(0xFF8B5CF6), // violet
  Color(0xFF0EA5E9), // sky
  Color(0xFF22C55E), // green
  Color(0xFFEC4899), // pink
  Color(0xFFEAB308), // yellow
];

Color _participantColor(String name, List<String> namedParticipants) {
  if (name == SplitBillBloc.you) return _kSplitPalette[0];
  final index = namedParticipants.indexOf(name);
  return _kSplitPalette[(index + 1) % _kSplitPalette.length];
}

String _initialsFor(String name) {
  final words =
      name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '?';
  if (words.length == 1) return words.first[0].toUpperCase();
  return (words.first[0] + words.last[0]).toUpperCase();
}

String _fractionLabel(double fraction) {
  if ((fraction - 0.5).abs() < 1e-3) return '½';
  if ((fraction - 1 / 3).abs() < 1e-3) return '⅓';
  return '';
}

class _SplitBillView extends StatelessWidget {
  const _SplitBillView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('split-bill-screen'),
      backgroundColor: Colors.transparent,
      appBar: WobblioHeaderBar(
        title: 'Split bill',
        onBack: () => Navigator.of(context).maybePop(),
      ),
      body: SafeArea(
        child: BlocConsumer<SplitBillBloc, SplitBillState>(
          listenWhen: (prev, curr) =>
              curr.notice != null && prev.notice != curr.notice,
          listener: (context, state) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          },
          builder: (context, state) => _buildBody(context, state),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, SplitBillState state) {
    if (state.status == SplitBillStatus.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.status == SplitBillStatus.forbidden) {
      return const _UpsellCard();
    }
    if (state.status == SplitBillStatus.failure) {
      return _RetryMessage(
        onRetry: () =>
            context.read<SplitBillBloc>().add(const SplitBillStarted()),
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _HeaderCard(state: state),
          const SizedBox(height: 20),
          _PeopleSection(state: state),
          const SizedBox(height: 20),
          _AssignItemsSection(state: state),
          const SizedBox(height: 10),
          _ProgressLine(state: state),
          if (state.summary != null) ...[
            const SizedBox(height: 20),
            _SummarySection(state: state),
          ],
          const SizedBox(height: 20),
          const _ActionButtons(),
        ],
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.state});

  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      formatMoney(state.currency, state.total ?? 0),
      if (state.transactionDate != null) state.transactionDate!,
    ].join(' · ');
    return GlassContainer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.merchant,
              style: AppTypography.display(size: AppTypography.textXl),),
          const SizedBox(height: 4),
          Text(subtitle,
              style: AppTypography.body(
                  size: AppTypography.textSm, color: AppColors.textMuted,),),
        ],
      ),
    );
  }
}

class _PeopleSection extends StatelessWidget {
  const _PeopleSection({required this.state});

  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('PEOPLE', style: AppTypography.overline()),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _PersonChip(
              name: SplitBillBloc.you,
              selected: state.activeParticipant == SplitBillBloc.you,
              color: _participantColor(SplitBillBloc.you, state.participants),
              onTap: () => context
                  .read<SplitBillBloc>()
                  .add(const SplitBillParticipantSelected(SplitBillBloc.you)),
            ),
            for (final name in state.participants)
              _PersonChip(
                name: name,
                selected: state.activeParticipant == name,
                color: _participantColor(name, state.participants),
                onTap: () => context
                    .read<SplitBillBloc>()
                    .add(SplitBillParticipantSelected(name)),
                onRemove: () => context
                    .read<SplitBillBloc>()
                    .add(SplitBillParticipantRemoved(name)),
              ),
          ],
        ),
        const SizedBox(height: 10),
        const _AddParticipantRow(),
      ],
    );
  }
}

class _PersonChip extends StatelessWidget {
  const _PersonChip({
    required this.name,
    required this.selected,
    required this.color,
    required this.onTap,
    this.onRemove,
  });

  final String name;
  final bool selected;
  final Color color;
  final VoidCallback onTap;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: Key('split-chip-$name'),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandGlow : AppColors.glassHighlight,
          border: Border.all(
              color: selected ? AppColors.brandBorder : AppColors.glassBorder,),
          borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Avatar(initials: _initialsFor(name), size: 22, background: color),
            const SizedBox(width: 6),
            Text(name,
                style: AppTypography.body(
                    size: AppTypography.textSm, weight: FontWeight.w600,),),
            if (onRemove != null) ...[
              const SizedBox(width: 4),
              GestureDetector(
                key: Key('split-chip-remove-$name'),
                onTap: onRemove,
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child:
                      Icon(Icons.close, size: 14, color: AppColors.textMuted),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AddParticipantRow extends StatefulWidget {
  const _AddParticipantRow();

  @override
  State<_AddParticipantRow> createState() => _AddParticipantRowState();
}

class _AddParticipantRowState extends State<_AddParticipantRow> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: WobblioInput(
            key: const Key('split-participant-input'),
            controller: _controller,
            onSubmitted: (_) => _submit(context),
          ),
        ),
        const SizedBox(width: 8),
        WobblioButton(
          key: const Key('split-add-participant'),
          label: 'Add',
          variant: WobblioButtonVariant.outline,
          onPressed: () => _submit(context),
        ),
      ],
    );
  }

  void _submit(BuildContext context) {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    context.read<SplitBillBloc>().add(SplitBillParticipantAdded(text));
    _controller.clear();
  }
}

class _AssignItemsSection extends StatelessWidget {
  const _AssignItemsSection({required this.state});

  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('ASSIGN ITEMS', style: AppTypography.overline()),
            Text.rich(
              TextSpan(
                style: AppTypography.body(
                    size: AppTypography.textXs, color: AppColors.textMuted,),
                children: [
                  const TextSpan(text: 'tap → '),
                  TextSpan(
                      text: state.activeParticipant,
                      style: const TextStyle(fontWeight: FontWeight.w700),),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final line in state.lines) _LineRow(line: line, state: state),
      ],
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({required this.line, required this.state});

  final InvoiceLineDetail line;
  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final assignment = state.assignmentFor(line.id);
    final ownerName = assignment?.participantName ?? SplitBillBloc.you;
    final fraction = assignment?.fraction ?? 1;
    return GestureDetector(
      key: Key('split-assign-${line.id}'),
      onTap: () =>
          context.read<SplitBillBloc>().add(SplitBillLineTapped(line.id)),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.glassBorder)),),
        child: Row(
          children: [
            Expanded(
              child: Text(
                line.rawText,
                style: AppTypography.body(
                    size: AppTypography.textSm, weight: FontWeight.w500,),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              formatMoney(state.currency, line.lineTotal),
              style: AppTypography.body(
                  size: AppTypography.textSm, weight: FontWeight.w700,),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 24,
              height: 24,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Avatar(
                    initials: _initialsFor(ownerName),
                    size: 24,
                    background: _participantColor(ownerName, state.participants),
                  ),
                  if ((fraction - 1).abs() > 1e-9)
                    Positioned(
                      right: -4,
                      bottom: -4,
                      child: Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.glassBorder),
                        ),
                        child: Text(_fractionLabel(fraction),
                            style: AppTypography.overline(size: 9),),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine({required this.state});

  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final summary = state.summary;
    final assignedToOthers = summary == null
        ? 0.0
        : summary.participants
            .where((p) => p.name != SplitBillBloc.you)
            .fold(0.0, (sum, p) => sum + p.total);
    final grandTotal = summary?.grandTotal ?? 0.0;
    return Text(
      '${formatMoney(state.currency, assignedToOthers)} of '
      '${formatMoney(state.currency, grandTotal)} assigned · tap a line '
      'again for ½ or ⅓',
      style: AppTypography.body(
          size: AppTypography.textXs, color: AppColors.textMuted,),
    );
  }
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.state});

  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final summary = state.summary!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('EACH PERSON OWES', style: AppTypography.overline()),
        const SizedBox(height: 10),
        for (final participant in summary.participants) ...[
          _ParticipantCard(participant: participant, state: state),
          const SizedBox(height: 10),
        ],
        Container(
          padding: const EdgeInsets.only(top: 10),
          decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.glassBorder)),),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total',
                  style: AppTypography.body(
                      size: AppTypography.textMd, weight: FontWeight.w700,),),
              Text(
                formatMoney(state.currency, summary.grandTotal),
                style: AppTypography.display(
                    size: AppTypography.textLg,
                    weight: FontWeight.w800,
                    tabularNumbers: true,),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ParticipantCard extends StatelessWidget {
  const _ParticipantCard({required this.participant, required this.state});

  final SplitParticipant participant;
  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      key: Key('split-summary-${participant.name}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Avatar(
                    initials: _initialsFor(participant.name),
                    size: 22,
                    background:
                        _participantColor(participant.name, state.participants),
                  ),
                  const SizedBox(width: 8),
                  Text(participant.name,
                      style: AppTypography.body(
                          size: AppTypography.textMd, weight: FontWeight.w700,),),
                ],
              ),
              Text(
                formatMoney(state.currency, participant.total),
                style: AppTypography.body(
                    size: AppTypography.textSm, weight: FontWeight.w700,),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final item in participant.items) _ItemLine(item: item, state: state),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Fees & charges',
                    style: AppTypography.body(
                        size: AppTypography.textXs,
                        color: AppColors.textMuted,),),
                Text(
                  formatMoney(state.currency, participant.fees),
                  style: AppTypography.body(
                      size: AppTypography.textXs, color: AppColors.textMuted,),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemLine extends StatelessWidget {
  const _ItemLine({required this.item, required this.state});

  final SplitItem item;
  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final qtyLabel =
        item.qty == item.qty.roundToDouble() ? item.qty.toInt() : item.qty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              '${item.label} ×$qtyLabel',
              style: AppTypography.body(
                  size: AppTypography.textXs, color: AppColors.textSecondary,),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            formatMoney(state.currency, item.amount),
            style: AppTypography.body(
                size: AppTypography.textXs, color: AppColors.textSecondary,),
          ),
        ],
      ),
    );
  }
}

class _ActionButtons extends StatelessWidget {
  const _ActionButtons();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        WobblioButton(
          key: const Key('split-share-whatsapp'),
          label: 'Share via WhatsApp',
          iconLeft: Icons.chat_bubble_outline,
          onPressed: () => context
              .read<SplitBillBloc>()
              .add(const SplitBillWhatsAppRequested()),
        ),
        const SizedBox(height: 8),
        WobblioButton(
          key: const Key('split-copy-summary'),
          label: 'Copy summary',
          variant: WobblioButtonVariant.outline,
          iconLeft: Icons.copy_outlined,
          onPressed: () =>
              context.read<SplitBillBloc>().add(const SplitBillCopyRequested()),
        ),
      ],
    );
  }
}

class _UpsellCard extends StatelessWidget {
  const _UpsellCard();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: GlassContainer(
          key: const Key('split-bill-upsell'),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.groups_outlined, size: 40, color: AppColors.brand),
              const SizedBox(height: 12),
              Text(
                'Bill splitting is a Premium feature',
                style: AppTypography.body(
                    size: AppTypography.textLg, weight: FontWeight.w700,),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Premium lets you assign receipt lines to friends or '
                'housemates, with a live per-person total and a one-tap '
                'WhatsApp export.',
                style: AppTypography.body(
                    size: AppTypography.textSm, color: AppColors.textMuted,),
                textAlign: TextAlign.center,
              ),
            ],
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
          Text('Couldn’t load this split',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
