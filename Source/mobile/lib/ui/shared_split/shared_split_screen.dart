import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/shared_split/shared_split_bloc.dart';
import 'package:wobblio/core/splitting/shared_split.dart';
import 'package:wobblio/core/splitting/split_summary.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/avatar.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';

/// Public, read-only shared bill split (`/s/{token}` deep link). A standalone
/// surface — no auth chrome, no bottom nav — reachable regardless of session
/// state (it only hits the unauthenticated `/shared-splits/{token}` resolver).
/// Ports the webapp's `shared-split-view.tsx`.
class SharedSplitScreen extends StatelessWidget {
  const SharedSplitScreen({super.key, required this.token});

  final String token;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SharedSplitBloc>(
      create: (_) => locator<SharedSplitBloc>(param1: token)
        ..add(const SharedSplitStarted()),
      child: const _SharedSplitView(),
    );
  }
}

const List<Color> _kSplitPalette = [
  Color(0xFF6366F1),
  Color(0xFF0D9488),
  Color(0xFFF59E0B),
  Color(0xFFF43F5E),
  Color(0xFF8B5CF6),
  Color(0xFF0EA5E9),
  Color(0xFF22C55E),
  Color(0xFFEC4899),
  Color(0xFFEAB308),
];

Color _participantColor(String name, List<String> names) {
  final index = names.indexOf(name);
  return _kSplitPalette[(index < 0 ? 0 : index) % _kSplitPalette.length];
}

String _initialsFor(String name) {
  final words =
      name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '?';
  if (words.length == 1) return words.first[0].toUpperCase();
  return (words.first[0] + words.last[0]).toUpperCase();
}

// A shared single item reads as its fraction glyph; everything else as a unit
// count. Ports `shared-split-view.tsx`'s `shareLabel`.
String _shareLabel(SplitItem item) {
  if ((item.fraction - 0.5).abs() < 1e-3) return '½';
  if ((item.fraction - 1 / 3).abs() < 1e-3) return '⅓';
  final qty = double.parse(item.qty.toStringAsFixed(2));
  return '×${qty == qty.roundToDouble() ? qty.toInt() : qty}';
}

class _SharedSplitView extends StatelessWidget {
  const _SharedSplitView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('shared-split-screen'),
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Wobblio',
            style: AppTypography.display(size: AppTypography.textLg),),
        centerTitle: false,
      ),
      body: SafeArea(
        child: BlocBuilder<SharedSplitBloc, SharedSplitState>(
          builder: (context, state) => switch (state.status) {
            SharedSplitStatus.loading =>
              const Center(child: CircularProgressIndicator()),
            SharedSplitStatus.notFound => const _InvalidLink(),
            SharedSplitStatus.failure => const _InvalidLink(),
            SharedSplitStatus.ready => _ReadyView(split: state.split!),
          },
        ),
      ),
    );
  }
}

class _ReadyView extends StatelessWidget {
  const _ReadyView({required this.split});

  final SharedSplit split;

  @override
  Widget build(BuildContext context) {
    final currency = split.currency ?? '';
    final names = [for (final p in split.participants) p.name];
    final peopleLabel = split.participants.length == 1 ? 'person' : 'people';
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('SHARED BILL SPLIT', style: AppTypography.overline()),
          const SizedBox(height: 4),
          Text('Who owes what',
              style: AppTypography.display(size: AppTypography.textXl),),
          const SizedBox(height: 16),
          GlassContainer(
            key: const Key('shared-split'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('SPLIT SUMMARY',
                              style: AppTypography.overline(),),
                          const SizedBox(height: 2),
                          Text(
                            split.merchant ?? 'Receipt',
                            style: AppTypography.display(
                                size: AppTypography.textLg,),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${split.participants.length} $peopleLabel',
                      style: AppTypography.body(
                          size: AppTypography.textXs,
                          color: AppColors.textMuted,),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.only(top: 12),
                  decoration: const BoxDecoration(
                    border: Border(
                        top: BorderSide(color: AppColors.glassBorder),),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        formatMediumDate(split.date ?? ''),
                        style: AppTypography.body(
                            size: AppTypography.textSm,
                            color: AppColors.textSecondary,),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('TOTAL', style: AppTypography.overline()),
                          Text(
                            formatMoney(currency, split.grandTotal),
                            style: AppTypography.display(
                                size: AppTypography.textLg,
                                weight: FontWeight.w800,
                                tabularNumbers: true,),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (final participant in split.participants) ...[
            _ParticipantCard(
                participant: participant, currency: currency, names: names,),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.verified_user_outlined,
                  size: 14, color: AppColors.textMuted,),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Each person’s share of taxes, tips and fees is included. '
                  'This link is read-only.',
                  style: AppTypography.body(
                      size: AppTypography.textXs, color: AppColors.textMuted,),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ParticipantCard extends StatelessWidget {
  const _ParticipantCard({
    required this.participant,
    required this.currency,
    required this.names,
  });

  final SplitParticipant participant;
  final String currency;
  final List<String> names;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      key: Key('shared-split-summary-${participant.name}'),
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
                    background: _participantColor(participant.name, names),
                  ),
                  const SizedBox(width: 8),
                  Text(participant.name,
                      style: AppTypography.body(
                          size: AppTypography.textMd,
                          weight: FontWeight.w700,),),
                ],
              ),
              Text(
                formatMoney(currency, participant.total),
                style: AppTypography.body(
                    size: AppTypography.textSm, weight: FontWeight.w700,),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final item in participant.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      '${item.label} ${_shareLabel(item)}',
                      style: AppTypography.body(
                          size: AppTypography.textXs,
                          color: AppColors.textSecondary,),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    formatMoney(currency, item.amount),
                    style: AppTypography.body(
                        size: AppTypography.textXs,
                        color: AppColors.textSecondary,),
                  ),
                ],
              ),
            ),
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
                  formatMoney(currency, participant.fees),
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

class _InvalidLink extends StatelessWidget {
  const _InvalidLink();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: GlassContainer(
          key: const Key('shared-split-invalid'),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  size: 40, color: AppColors.warning,),
              const SizedBox(height: 12),
              Text(
                'This link isn’t available',
                style: AppTypography.body(
                    size: AppTypography.textLg, weight: FontWeight.w700,),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'The share link is invalid or has expired. Ask the sender for '
                'a fresh one.',
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
