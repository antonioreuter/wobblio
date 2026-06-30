import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ingestion/usage_summary.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/usage_repository.dart';

part 'dashboard_event.dart';
part 'dashboard_state.dart';

/// Owns the mobile home: the recent-invoices list, the tag filter, weekly usage,
/// optimistic accuracy feedback, and terminal-status polling. Depends on ports
/// only; widgets stay logic-free (`.claude/rules/flutter-architecture-guard.md`).
class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  DashboardBloc({
    required IInvoiceRepository invoices,
    required IUsageRepository usage,
    List<Duration> pollSchedule = _defaultSchedule,
    int maxPollAttempts = _defaultMaxPollAttempts,
  })  : _invoices = invoices,
        _usage = usage,
        _pollSchedule = pollSchedule,
        _maxPollAttempts = maxPollAttempts,
        super(const DashboardState()) {
    on<DashboardStarted>(_onStarted);
    on<DashboardRefreshed>(_onRefreshed);
    on<DashboardTagSelected>(_onTagSelected);
    on<DashboardFeedbackSubmitted>(_onFeedback);
    on<_DashboardPollRequested>(_onPoll);
  }

  final IInvoiceRepository _invoices;
  final IUsageRepository _usage;
  final List<Duration> _pollSchedule;
  final int _maxPollAttempts;

  // Bumped on each poll run so a newer refresh supersedes an in-flight backoff loop.
  int _pollGen = 0;

  // Webapp cadence (workspace-provider.tsx): 2.5s / 5s / 9s ramp, then hold at the
  // last interval. The spec wants polling "until terminal", so we keep going past
  // the ramp at the final interval rather than giving up after three ticks.
  static const List<Duration> _defaultSchedule = [
    Duration(milliseconds: 2500),
    Duration(milliseconds: 5000),
    Duration(milliseconds: 9000),
  ];

  // Hard ceiling so a stuck PROCESSING row can't poll forever (battery/quota).
  // ~3 ramp ticks + 37 × 9s ≈ 5.5 min, after which the user pulls to refresh.
  static const int _defaultMaxPollAttempts = 40;

  Future<void> _onStarted(
    DashboardStarted event,
    Emitter<DashboardState> emit,
  ) async {
    emit(state.copyWith(status: DashboardStatus.loading));
    try {
      final invoices = await _invoices.list();
      final usage = await _safeUsage();
      emit(
        state.copyWith(
          status: DashboardStatus.ready,
          invoices: invoices,
          usage: usage,
        ),
      );
      _schedulePollIfNeeded(invoices);
    } catch (_) {
      emit(
        state.copyWith(
          status: DashboardStatus.failure,
          notice: 'Couldn’t load your receipts.',
        ),
      );
    }
  }

  Future<void> _onRefreshed(
    DashboardRefreshed event,
    Emitter<DashboardState> emit,
  ) async {
    emit(state.copyWith(isRefreshing: true, notice: null));
    try {
      final invoices = await _invoices.list();
      final usage = await _safeUsage();
      emit(
        state.copyWith(
          status: DashboardStatus.ready,
          invoices: invoices,
          usage: usage,
          isRefreshing: false,
        ),
      );
      _schedulePollIfNeeded(invoices);
    } catch (_) {
      emit(
        state.copyWith(
          isRefreshing: false,
          notice: 'Couldn’t refresh — pull down to retry.',
        ),
      );
    }
  }

  void _onTagSelected(
    DashboardTagSelected event,
    Emitter<DashboardState> emit,
  ) {
    final next = state.selectedTag == event.tag ? null : event.tag;
    emit(state.copyWith(selectedTag: next));
  }

  Future<void> _onFeedback(
    DashboardFeedbackSubmitted event,
    Emitter<DashboardState> emit,
  ) async {
    final previous = state.feedback[event.invoiceId];
    emit(
      state.copyWith(
        feedback: {...state.feedback, event.invoiceId: event.verdict},
      ),
    );
    try {
      await _invoices.recordFeedback(event.invoiceId, event.verdict);
    } catch (_) {
      // A newer rating for the same invoice (rapid re-tap) supersedes this one —
      // don't roll its optimistic value back or report this stale failure.
      if (state.feedback[event.invoiceId] != event.verdict) return;
      emit(
        state.copyWith(
          feedback: _withVerdict(state.feedback, event.invoiceId, previous),
          notice: 'Couldn’t save your feedback — please try again.',
        ),
      );
    }
  }

  // Walks the backoff schedule, refetching until every row is terminal (or the
  // run is superseded by a newer refresh). Runs in the bloc, never in widgets.
  Future<void> _onPoll(
    _DashboardPollRequested event,
    Emitter<DashboardState> emit,
  ) async {
    final gen = ++_pollGen;
    for (var attempt = 0; attempt < _maxPollAttempts; attempt++) {
      // Ramp through the backoff, then hold at the last interval until terminal.
      final delay = attempt < _pollSchedule.length
          ? _pollSchedule[attempt]
          : _pollSchedule.last;
      await Future<void>.delayed(delay);
      if (gen != _pollGen || emit.isDone) return;
      final List<InvoiceSummary> invoices;
      try {
        invoices = await _invoices.list();
      } catch (_) {
        continue; // keep the last good list; try again next tick
      }
      final usage = await _safeUsage();
      // Re-check after every await: a newer refresh must win the last write.
      if (gen != _pollGen || emit.isDone) return;
      emit(state.copyWith(invoices: invoices, usage: usage));
      if (!invoices.any((inv) => inv.isProcessing)) return;
    }
  }

  void _schedulePollIfNeeded(List<InvoiceSummary> invoices) {
    if (invoices.any((inv) => inv.isProcessing)) {
      add(const _DashboardPollRequested());
    }
  }

  Future<UsageSummary?> _safeUsage() async {
    try {
      return await _usage.fetch();
    } catch (_) {
      return null; // usage is supplementary — never fail the list load over it
    }
  }

  static Map<String, FeedbackVerdict> _withVerdict(
    Map<String, FeedbackVerdict> current,
    String invoiceId,
    FeedbackVerdict? verdict,
  ) {
    final next = Map<String, FeedbackVerdict>.from(current);
    if (verdict == null) {
      next.remove(invoiceId);
    } else {
      next[invoiceId] = verdict;
    }
    return next;
  }
}
