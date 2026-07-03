import 'package:equatable/equatable.dart';

/// One priced line inside a participant's itemized breakdown
/// (`GET /invoices/{id}/splits/{splitId}/summary`).
class SplitItem extends Equatable {
  const SplitItem({
    required this.lineId,
    required this.label,
    required this.qty,
    required this.fraction,
    required this.amount,
  });

  final String lineId;
  final String label;
  final double qty;
  final double fraction;
  final double amount;

  @override
  List<Object?> get props => [lineId, label, qty, fraction, amount];
}

/// One participant's per-person total: itemized lines, their proportional
/// share of fees/discounts, and the resulting grand total. The fee-pool
/// proportional-share math (`computeSplitSummary`) lives only on the
/// backend — this is a read-only projection, never recomputed client-side.
class SplitParticipant extends Equatable {
  const SplitParticipant({
    required this.name,
    required this.subtotal,
    required this.fees,
    required this.total,
    required this.items,
  });

  final String name;
  final double subtotal;
  final double fees;
  final double total;
  final List<SplitItem> items;

  @override
  List<Object?> get props => [name, subtotal, fees, total, items];
}

/// The full per-person split (`GET /invoices/{id}/splits/{splitId}/summary`).
class SplitSummary extends Equatable {
  const SplitSummary({required this.participants, required this.grandTotal});

  final List<SplitParticipant> participants;
  final double grandTotal;

  @override
  List<Object?> get props => [participants, grandTotal];
}
