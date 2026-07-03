part of 'report_bloc.dart';

sealed class ReportEvent extends Equatable {
  const ReportEvent();

  @override
  List<Object?> get props => [];
}

/// First load: resolve `country`/`regionCode`/`isPremium` from the caller's
/// profile. No products are pre-selected — the chart starts empty.
class ReportsStarted extends ReportEvent {
  const ReportsStarted();
}

/// Product-search box changed — debounced the same way `ReviewBloc` debounces
/// its line-item product search (min 2 chars, generation-counter guard).
class ReportProductQueryChanged extends ReportEvent {
  const ReportProductQueryChanged(this.query);

  final String query;

  @override
  List<Object?> get props => [query];
}

/// A suggestion was tapped — no-op if already at the 3-product cap or the
/// product is already selected.
class ReportProductAdded extends ReportEvent {
  const ReportProductAdded(this.product);

  final ProductMatch product;

  @override
  List<Object?> get props => [product];
}

/// A selected-product chip's remove `×` was tapped.
class ReportProductRemoved extends ReportEvent {
  const ReportProductRemoved(this.productId);

  final String productId;

  @override
  List<Object?> get props => [productId];
}

/// "My prices" / "Local market" toggle — market is Premium-only.
class ReportModeChanged extends ReportEvent {
  const ReportModeChanged(this.mode);

  final ReportMode mode;

  @override
  List<Object?> get props => [mode];
}
