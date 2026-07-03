import 'package:equatable/equatable.dart';

/// One receipt-line → participant assignment
/// (`GET /invoices/{id}/splits/{splitId}`).
class SplitAssignment extends Equatable {
  const SplitAssignment({
    required this.lineId,
    required this.participantName,
    required this.fraction,
  });

  final String lineId;
  final String participantName;
  final double fraction;

  @override
  List<Object?> get props => [lineId, participantName, fraction];
}
