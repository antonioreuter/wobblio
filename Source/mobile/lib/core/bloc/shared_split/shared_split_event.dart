part of 'shared_split_bloc.dart';

sealed class SharedSplitEvent extends Equatable {
  const SharedSplitEvent();

  @override
  List<Object?> get props => [];
}

/// First (and only) load: resolve the token via `GET /shared-splits/{token}`.
class SharedSplitStarted extends SharedSplitEvent {
  const SharedSplitStarted();
}
