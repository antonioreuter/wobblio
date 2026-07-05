part of 'split_bill_bloc.dart';

enum SplitBillStatus { loading, ready, forbidden, failure }

/// Single immutable split-bill state. [participants] is a local-only growing
/// set (seeded from the backend's distinct allocation names, grown after
/// every refresh, never shrunk except an explicit
/// [SplitBillParticipantRemoved]) — `"You"` (see [SplitBillBloc.you]) is a
/// fixed sentinel and never appears in it. [lines] already excludes
/// discount/deposit-or-fee lines. [allocations] may carry several entries per
/// line (multiple participants sharing its units). [summary] is refetched from
/// the backend after every mutation — the fee-pool-proportional-share math is
/// never recomputed client-side. [shareUrl] is set once a `/s/{token}` link has
/// been minted.
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
    this.allocations = const [],
    this.summary,
    this.shareUrl,
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
  final List<SplitAllocation> allocations;
  final SplitSummary? summary;
  final String? shareUrl;
  final String? notice;

  /// Every allocation on [lineId] (may be empty, or several participants).
  List<SplitAllocation> allocationsFor(String lineId) =>
      [for (final a in allocations) if (a.lineId == lineId) a];

  /// The units [name] holds on [lineId] (0 if none).
  double unitsFor(String lineId, String name) {
    for (final a in allocations) {
      if (a.lineId == lineId && a.participantName == name) return a.units;
    }
    return 0;
  }

  /// The total units already allocated across all participants on [lineId].
  double assignedUnits(String lineId) {
    var total = 0.0;
    for (final a in allocations) {
      if (a.lineId == lineId) total += a.units;
    }
    return total;
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
    List<SplitAllocation>? allocations,
    // splitId/summary/shareUrl/notice are nullable-with-clear, so use sentinels.
    Object? splitId = _unset,
    Object? summary = _unset,
    Object? shareUrl = _unset,
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
      allocations: allocations ?? this.allocations,
      summary: summary == _unset ? this.summary : summary as SplitSummary?,
      shareUrl: shareUrl == _unset ? this.shareUrl : shareUrl as String?,
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
        allocations,
        summary,
        shareUrl,
        notice,
      ];
}

const Object _unset = Object();
