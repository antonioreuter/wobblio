part of 'price_report_bloc.dart';

sealed class PriceReportEvent extends Equatable {
  const PriceReportEvent();

  @override
  List<Object?> get props => [];
}

/// First load (and retry): fetch the inflation insight + resolve the region label.
class PriceReportStarted extends PriceReportEvent {
  const PriceReportStarted();
}
