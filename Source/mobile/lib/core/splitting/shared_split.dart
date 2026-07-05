import 'package:equatable/equatable.dart';

import 'package:wobblio/core/splitting/split_summary.dart';

/// The public, read-only projection of a shared bill split
/// (`GET /shared-splits/{token}`, unauthenticated). Reuses the per-person
/// [SplitParticipant]/[SplitItem] shape the authed `/summary` returns, plus the
/// receipt header the standalone page needs (merchant, date, currency).
class SharedSplit extends Equatable {
  const SharedSplit({
    required this.merchant,
    required this.date,
    required this.currency,
    required this.participants,
    required this.grandTotal,
  });

  final String? merchant;
  final String? date;
  final String? currency;
  final List<SplitParticipant> participants;
  final double grandTotal;

  @override
  List<Object?> get props => [merchant, date, currency, participants, grandTotal];
}
