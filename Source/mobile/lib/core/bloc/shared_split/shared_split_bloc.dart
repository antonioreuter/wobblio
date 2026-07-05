import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/shared_split.dart';

part 'shared_split_event.dart';
part 'shared_split_state.dart';

/// Drives the public read-only shared-split page (`/s/{token}` deep link →
/// `GET /shared-splits/{token}`). Unauthenticated — the token in the link is
/// the only credential — so this never touches the profile/premium gate. A 404
/// (invalid or expired link) is a distinct [SharedSplitStatus.notFound] state,
/// not a generic failure. Ports the webapp's `s/[token]/page.tsx` +
/// `shared-split-view.tsx`.
class SharedSplitBloc extends Bloc<SharedSplitEvent, SharedSplitState> {
  SharedSplitBloc({required ISplitRepository splits, required this.token})
      : _splits = splits,
        super(const SharedSplitState()) {
    on<SharedSplitStarted>(_onStarted);
  }

  final ISplitRepository _splits;
  final String token;

  Future<void> _onStarted(
    SharedSplitStarted event,
    Emitter<SharedSplitState> emit,
  ) async {
    emit(const SharedSplitState());
    try {
      final split = await _splits.getSharedSplit(token);
      emit(state.copyWith(status: SharedSplitStatus.ready, split: split));
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          status: error.statusCode == 404
              ? SharedSplitStatus.notFound
              : SharedSplitStatus.failure,
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: SharedSplitStatus.failure));
    }
  }
}
