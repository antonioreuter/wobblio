part of 'dashboard_bloc.dart';

sealed class DashboardEvent extends Equatable {
  const DashboardEvent();

  @override
  List<Object?> get props => [];
}

/// First load: fetch invoices + usage, then poll if anything is still processing.
class DashboardStarted extends DashboardEvent {
  const DashboardStarted();
}

/// Pull-to-refresh (or return-from-capture): refetch invoices + usage, re-poll.
class DashboardRefreshed extends DashboardEvent {
  const DashboardRefreshed();
}

/// Toggle the active tag filter (null / same tag again clears it).
class DashboardTagSelected extends DashboardEvent {
  const DashboardTagSelected(this.tag);

  final String? tag;

  @override
  List<Object?> get props => [tag];
}

/// Optimistically rate an invoice, then persist; revert on failure.
class DashboardFeedbackSubmitted extends DashboardEvent {
  const DashboardFeedbackSubmitted(this.invoiceId, this.verdict);

  final String invoiceId;
  final FeedbackVerdict verdict;

  @override
  List<Object?> get props => [invoiceId, verdict];
}

/// Internal: walk the backoff schedule, refetching until no row is processing.
class _DashboardPollRequested extends DashboardEvent {
  const _DashboardPollRequested();
}
