part of 'shared_split_bloc.dart';

enum SharedSplitStatus { loading, ready, notFound, failure }

/// Immutable state for the public shared-split page. [split] is populated only
/// in [SharedSplitStatus.ready]; [SharedSplitStatus.notFound] is the
/// invalid/expired-link case (a 404 from the resolver).
class SharedSplitState extends Equatable {
  const SharedSplitState({
    this.status = SharedSplitStatus.loading,
    this.split,
  });

  final SharedSplitStatus status;
  final SharedSplit? split;

  SharedSplitState copyWith({
    SharedSplitStatus? status,
    SharedSplit? split,
  }) {
    return SharedSplitState(
      status: status ?? this.status,
      split: split ?? this.split,
    );
  }

  @override
  List<Object?> get props => [status, split];
}
