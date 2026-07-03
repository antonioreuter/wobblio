part of 'split_bill_bloc.dart';

enum SplitBillStatus { loading, ready, forbidden, failure }

/// Single immutable split-bill state. [participants] is a local-only growing
/// set (seeded from the backend's distinct assignment names, grown after
/// every refresh, never shrunk except an explicit
/// [SplitBillParticipantRemoved]) — `"You"` (see [SplitBillBloc.you]) is a
/// fixed sentinel and never appears in it. [lines] already excludes
/// discount/deposit-or-fee lines. [summary] is refetched from the backend
/// after every mutation — the fee-pool-proportional-share math is never
/// recomputed client-side.
class SplitBillState extends Equatable {
  const SplitBillState({
    this.status = SplitBillStatus.loading,
    this.splitId,
    this.merchant = '',
    this.total,
    this.currency = 'EUR',
    this.transactionDate,
    this.lines = const [],
    this.participants = const [],
    this.activeParticipant = SplitBillBloc.you,
    this.assignments = const [],
    this.summary,
    this.notice,
  });

  final SplitBillStatus status;
  final String? splitId;
  final String merchant;
  final double? total;
  final String currency;
  final String? transactionDate;
  final List<InvoiceLineDetail> lines;
  final List<String> participants;
  final String activeParticipant;
  final List<SplitAssignment> assignments;
  final SplitSummary? summary;
  final String? notice;

  SplitAssignment? assignmentFor(String lineId) {
    for (final assignment in assignments) {
      if (assignment.lineId == lineId) return assignment;
    }
    return null;
  }

  SplitBillState copyWith({
    SplitBillStatus? status,
    String? merchant,
    double? total,
    String? currency,
    String? transactionDate,
    List<InvoiceLineDetail>? lines,
    List<String>? participants,
    String? activeParticipant,
    List<SplitAssignment>? assignments,
    // splitId/summary/notice are nullable-with-clear, so use explicit sentinels.
    Object? splitId = _unset,
    Object? summary = _unset,
    Object? notice = _unset,
  }) {
    return SplitBillState(
      status: status ?? this.status,
      splitId: splitId == _unset ? this.splitId : splitId as String?,
      merchant: merchant ?? this.merchant,
      total: total ?? this.total,
      currency: currency ?? this.currency,
      transactionDate: transactionDate ?? this.transactionDate,
      lines: lines ?? this.lines,
      participants: participants ?? this.participants,
      activeParticipant: activeParticipant ?? this.activeParticipant,
      assignments: assignments ?? this.assignments,
      summary: summary == _unset ? this.summary : summary as SplitSummary?,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props => [
        status,
        splitId,
        merchant,
        total,
        currency,
        transactionDate,
        lines,
        participants,
        activeParticipant,
        assignments,
        summary,
        notice,
      ];
}

const Object _unset = Object();
