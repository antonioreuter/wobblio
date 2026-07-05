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
/// `bill-split-dialog.tsx`). Premium accounts get the full assignment flow:
/// people chips, assignable line rows (multi-unit +/− steppers, single-unit
/// tap-to-cycle), a per-person summary, a public share link, and a WhatsApp
/// export. See `specs/mvp/18-mobile-navigation-and-lists/18h-split-bill.md`.
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

// How a participant's share of a line reads on their avatar badge: a unit count
// for multi-unit lines (×2), a fraction glyph for a shared single item (½),
// else nothing. Ports the webapp's `shareLabel`.
String _shareLabel(double units, double lineQuantity) {
  if (lineQuantity > 1 + 1e-3) {
    final rounded = double.parse(units.toStringAsFixed(2));
    return '×${rounded == rounded.roundToDouble() ? rounded.toInt() : rounded}';
  }
  return _fractionLabel(units);
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
          _ShareSection(state: state),
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
                  const TextSpan(text: 'to '),
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

  bool get _isMulti => line.quantity > 1 + 1e-3;

  @override
  Widget build(BuildContext context) {
    final active = state.activeParticipant;
    final isYou = active == SplitBillBloc.you;
    final hasAllocations = state.allocationsFor(line.id).isNotEmpty;

    final row = Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.glassBorder)),),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(
                    style: AppTypography.body(
                        size: AppTypography.textSm, weight: FontWeight.w500,),
                    children: [
                      TextSpan(text: line.rawText),
                      if (_isMulti)
                        TextSpan(
                          text: '  ×${_qtyLabel(line.quantity)}',
                          style: AppTypography.body(
                              size: AppTypography.textXs,
                              color: AppColors.textMuted,),
                        ),
                    ],
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                formatMoney(state.currency, line.lineTotal),
                style: AppTypography.body(
                    size: AppTypography.textSm, weight: FontWeight.w700,),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _OwnerStack(line: line, state: state)),
              if (_isMulti && !isYou)
                _Stepper(line: line, state: state)
              else if (_isMulti && isYou && hasAllocations)
                _ResetButton(lineId: line.id)
              else if (!_isMulti)
                Text(
                  isYou ? 'tap to clear' : 'tap → ½ → ⅓',
                  style: AppTypography.body(
                      size: AppTypography.textXs, color: AppColors.textMuted,),
                ),
            ],
          ),
        ],
      ),
    );

    // Single-unit lines are tap-to-cycle; multi-unit lines drive from the
    // stepper/reset controls instead, so their row body is static.
    if (_isMulti) return row;
    return GestureDetector(
      key: Key('split-assign-${line.id}'),
      onTap: () =>
          context.read<SplitBillBloc>().add(SplitBillLineTapped(line.id)),
      child: row,
    );
  }
}

// The set of owners on a line: every allocation, plus the unallocated remainder
// attributed to "You". Mirrors the webapp's `owners` derivation.
class _OwnerStack extends StatelessWidget {
  const _OwnerStack({required this.line, required this.state});

  final InvoiceLineDetail line;
  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final allocs = state.allocationsFor(line.id);
    final remainder = line.quantity - state.assignedUnits(line.id);
    final owners = <(String, double)>[
      for (final a in allocs) (a.participantName, a.units),
      if (remainder > 1e-3) (SplitBillBloc.you, remainder),
    ];
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final owner in owners)
          _OwnerAvatar(
            name: owner.$1,
            badge: _shareLabel(owner.$2, line.quantity),
            color: _participantColor(owner.$1, state.participants),
          ),
      ],
    );
  }
}

class _OwnerAvatar extends StatelessWidget {
  const _OwnerAvatar({
    required this.name,
    required this.badge,
    required this.color,
  });

  final String name;
  final String badge;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 26,
      height: 26,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Avatar(initials: _initialsFor(name), size: 24, background: color),
          if (badge.isNotEmpty)
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
                child: Text(badge, style: AppTypography.overline(size: 9)),
              ),
            ),
        ],
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.line, required this.state});

  final InvoiceLineDetail line;
  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    final active = state.activeParticipant;
    final myUnits = state.unitsFor(line.id, active);
    final remainder = line.quantity - state.assignedUnits(line.id);
    return Row(
      key: Key('split-stepper-${line.id}'),
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepButton(
          icon: Icons.remove,
          buttonKey: Key('split-minus-${line.id}'),
          enabled: myUnits > 1e-3,
          onPressed: () => context
              .read<SplitBillBloc>()
              .add(SplitBillLineStepped(line.id, -1)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            _qtyLabel(myUnits),
            key: Key('split-units-${line.id}'),
            style: AppTypography.body(
                size: AppTypography.textSm, weight: FontWeight.w700,),
          ),
        ),
        _StepButton(
          icon: Icons.add,
          buttonKey: Key('split-plus-${line.id}'),
          enabled: remainder > 1e-3,
          onPressed: () => context
              .read<SplitBillBloc>()
              .add(SplitBillLineStepped(line.id, 1)),
        ),
      ],
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.buttonKey,
    required this.enabled,
    required this.onPressed,
  });

  final IconData icon;
  final Key buttonKey;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: buttonKey,
      onTap: enabled ? onPressed : null,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: AppColors.glassHighlight,
          border: Border.all(color: AppColors.glassBorder),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Icon(
          icon,
          size: 16,
          color: enabled ? AppColors.textSecondary : AppColors.textMuted,
        ),
      ),
    );
  }
}

class _ResetButton extends StatelessWidget {
  const _ResetButton({required this.lineId});

  final String lineId;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: Key('split-reset-$lineId'),
      onTap: () =>
          context.read<SplitBillBloc>().add(SplitBillLineReset(lineId)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.refresh, size: 14, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text('Reset',
              style: AppTypography.body(
                  size: AppTypography.textXs, color: AppColors.textMuted,),),
        ],
      ),
    );
  }
}

String _qtyLabel(double value) {
  final rounded = double.parse(value.toStringAsFixed(2));
  return rounded == rounded.roundToDouble()
      ? rounded.toInt().toString()
      : rounded.toString();
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
      '${formatMoney(state.currency, grandTotal)} assigned · use +/− for '
      'quantities, tap a single item for ½ or ⅓',
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
    final fraction = _fractionLabel(item.fraction);
    final label = fraction.isNotEmpty ? fraction : '×${_qtyLabel(item.qty)}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              '${item.label} $label',
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

// "Share this split" — mints a public read-only /s/<token> link (7-day expiry)
// and, once created, surfaces it for copy/re-share. Mirrors the webapp's
// share-link section; the native share sheet is triggered in the bloc.
class _ShareSection extends StatelessWidget {
  const _ShareSection({required this.state});

  final SplitBillState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('SHARE THIS SPLIT', style: AppTypography.overline()),
        const SizedBox(height: 10),
        if (state.shareUrl != null)
          GlassContainer(
            key: const Key('split-share-link'),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    state.shareUrl!,
                    style: AppTypography.body(
                        size: AppTypography.textSm,
                        color: AppColors.textSecondary,),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                WobblioButton(
                  key: const Key('split-reshare-link'),
                  label: 'Share',
                  variant: WobblioButtonVariant.outline,
                  iconLeft: Icons.ios_share,
                  onPressed: () => context
                      .read<SplitBillBloc>()
                      .add(const SplitBillShareLinkRequested()),
                ),
              ],
            ),
          )
        else
          WobblioButton(
            key: const Key('split-share-create'),
            label: 'Create share link',
            variant: WobblioButtonVariant.outline,
            iconLeft: Icons.link,
            onPressed: () => context
                .read<SplitBillBloc>()
                .add(const SplitBillShareLinkRequested()),
          ),
        const SizedBox(height: 6),
        Text(
          'A read-only page anyone can open — like sharing a receipt. '
          'The link expires in 7 days.',
          style: AppTypography.body(
              size: AppTypography.textXs, color: AppColors.textMuted,),
        ),
      ],
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
