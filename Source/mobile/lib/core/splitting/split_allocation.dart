import 'package:equatable/equatable.dart';

/// One participant's slice of a receipt line, measured in that line's units
/// (`GET /invoices/{id}/splits/{splitId}` → `allocations[]`). Fractional units
/// express a shared single item (½ = 0.5); several allocations may target the
/// same [lineId] (e.g. 3 items → 2 to Alice, 1 to Bob, remainder → "You").
class SplitAllocation extends Equatable {
  const SplitAllocation({
    required this.lineId,
    required this.participantName,
    required this.units,
  });

  final String lineId;
  final String participantName;
  final double units;

  @override
  List<Object?> get props => [lineId, participantName, units];
}

/// One entry in the full allocation set a `PUT
/// /invoices/{id}/splits/{splitId}/lines/{lineId}/allocations` replaces —
/// mirrors the webapp's `LineAllocationInput`.
class LineAllocation extends Equatable {
  const LineAllocation({required this.participantName, required this.units});

  final String participantName;
  final double units;

  @override
  List<Object?> get props => [participantName, units];
}
