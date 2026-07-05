part of 'price_report_bloc.dart';

enum PriceReportStatus { loading, ready, failure }

/// Immutable Reports "Price report" state. [insight] carries every figure the
/// screen renders (personal %, region %, savings, trend); any of them may be null,
/// which the screen turns into an honest building-state. [regionLabel] is the
/// best-effort subtitle name (may be empty).
class PriceReportState extends Equatable {
  const PriceReportState({
    this.status = PriceReportStatus.loading,
    this.insight,
    this.regionLabel = '',
  });

  final PriceReportStatus status;
  final InflationInsight? insight;
  final String regionLabel;

  PriceReportState copyWith({
    PriceReportStatus? status,
    InflationInsight? insight,
    String? regionLabel,
  }) {
    return PriceReportState(
      status: status ?? this.status,
      insight: insight ?? this.insight,
      regionLabel: regionLabel ?? this.regionLabel,
    );
  }

  @override
  List<Object?> get props => [status, insight, regionLabel];
}
