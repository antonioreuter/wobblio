import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';

part 'history_event.dart';
part 'history_state.dart';

/// Owns the full receipts list (18b): reuses [IInvoiceRepository.list] (the
/// same `GET /invoices` call Dashboard makes — no pagination exists
/// server-side, see `specs/mvp/18-mobile-navigation-and-lists/18-00-handoff.md`)
/// and derives client-side search + month grouping. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class HistoryBloc extends Bloc<HistoryEvent, HistoryState> {
  HistoryBloc({
    required IInvoiceRepository invoices,
    DateTime Function() now = DateTime.now,
  })  : _invoices = invoices,
        _now = now,
        super(const HistoryState()) {
    on<HistoryStarted>(_onStarted);
    on<HistoryRefreshed>(_onRefreshed);
    on<HistorySearchChanged>(_onSearchChanged);
  }

  final IInvoiceRepository _invoices;
  final DateTime Function() _now;

  Future<void> _onStarted(
    HistoryStarted event,
    Emitter<HistoryState> emit,
  ) async {
    emit(state.copyWith(status: HistoryStatus.loading));
    await _load(emit);
  }

  Future<void> _onRefreshed(
    HistoryRefreshed event,
    Emitter<HistoryState> emit,
  ) async {
    // Clear any previous notice before retrying — otherwise two consecutive
    // identical-text failures produce an unchanged state and the screen's
    // listener never fires for the second one.
    emit(state.copyWith(isRefreshing: true, notice: null));
    await _load(emit, isRefreshing: true);
  }

  Future<void> _load(Emitter<HistoryState> emit,
      {bool isRefreshing = false,}) async {
    try {
      final invoices = await _invoices.list();
      emit(
        state.copyWith(
          status: HistoryStatus.ready,
          invoices: invoices,
          isRefreshing: false,
          now: _now(),
        ),
      );
    } catch (_) {
      emit(
        isRefreshing
            ? state.copyWith(
                isRefreshing: false,
                notice: 'Couldn’t refresh — pull down to retry.',)
            : state.copyWith(status: HistoryStatus.failure),
      );
    }
  }

  void _onSearchChanged(
    HistorySearchChanged event,
    Emitter<HistoryState> emit,
  ) {
    emit(state.copyWith(searchQuery: event.query));
  }
}
