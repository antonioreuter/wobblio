part of 'history_bloc.dart';

sealed class HistoryEvent extends Equatable {
  const HistoryEvent();

  @override
  List<Object?> get props => [];
}

/// First load: fetch the full invoice list.
class HistoryStarted extends HistoryEvent {
  const HistoryStarted();
}

/// Pull-to-refresh: refetch the list.
class HistoryRefreshed extends HistoryEvent {
  const HistoryRefreshed();
}

/// Merchant/tag search box changed.
class HistorySearchChanged extends HistoryEvent {
  const HistorySearchChanged(this.query);

  final String query;

  @override
  List<Object?> get props => [query];
}
