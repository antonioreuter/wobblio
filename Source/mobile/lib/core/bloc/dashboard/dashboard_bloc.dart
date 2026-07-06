import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ingestion/usage_summary.dart';
import 'package:wobblio/core/ports/insights_repository.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/usage_repository.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';

part 'dashboard_event.dart';
part 'dashboard_state.dart';

/// Owns the mobile home: the recent-invoices list, the tag filter, weekly usage,
/// optimistic accuracy feedback, and terminal-status polling. Depends on ports
/// only; widgets stay logic-free (`.claude/rules/flutter-architecture-guard.md`).
class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  DashboardBloc({
    required IInvoiceRepository invoices,
    required IUsageRepository usage,
    required IInsightsRepository insights,
    List<Duration> pollSchedule = _defaultSchedule,
    int maxPollAttempts = _defaultMaxPollAttempts,
  })  : _invoices = invoices,
        _usage = usage,
        _insights = insights,
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
  final IInsightsRepository _insights;
  final List<Duration> _pollSchedule;
  final int _maxPollAttempts;

  // Bumped on each poll run so a newer refresh supersedes an in-flight backoff loop.
  int _pollGen = 0;

  // Webapp cadence (workspace-provider.tsx, specs/fixes/07.02/03): 2.5s / 5s
  // ramp, then hold at 5s. Measured ingestion is p50 ~17.5s / p90 ~25s, so the
  // old 9s hold added up to 9s of pure staleness right when the receipt lands.
  static const List<Duration> _defaultSchedule = [
    Duration(milliseconds: 2500),
    Duration(milliseconds: 5000),
  ];

  // Hard ceiling so a stuck PROCESSING row can't poll forever (battery/quota).
  // 2 ramp ticks + 38 × 5s ≈ 3.3 min, after which the user pulls to refresh.
  static const int _defaultMaxPollAttempts = 40;

  Future<void> _onStarted(
    DashboardStarted event,
    Emitter<DashboardState> emit,
  ) async {
    emit(state.copyWith(status: DashboardStatus.loading));
    try {
      final invoices = await _invoices.list();
      final usage = await _safeUsage();
      final inflation = await _safeInflation();
      emit(
        state.copyWith(
          status: DashboardStatus.ready,
          invoices: invoices,
          usage: usage,
          inflation: inflation,
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
      final inflation = await _safeInflation();
      emit(
        state.copyWith(
          status: DashboardStatus.ready,
          invoices: invoices,
          usage: usage,
          inflation: inflation,
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
      // Only set the one-shot notice when a receipt actually finished, so a
      // plain tick never clears an unrelated notice mid-display.
      final notice = _readyNotice(state.invoices, invoices);
      emit(
        notice == null
            ? state.copyWith(invoices: invoices, usage: usage)
            : state.copyWith(invoices: invoices, usage: usage, notice: notice),
      );
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

  Future<InflationInsight?> _safeInflation() async {
    try {
      return await _insights.fetchInflation();
    } catch (_) {
      return null; // the inflation card is supplementary — never fail the load over it
    }
  }

  // A receipt left PROCESSING between two poll ticks (specs/fixes/07.03): tell
  // the user in-app instead of waiting for them to notice the row change.
  // Polling is the trigger — background delivery stays 16f push's job.
  static String? _readyNotice(
    List<InvoiceSummary> previous,
    List<InvoiceSummary> next,
  ) {
    final wasProcessing = {
      for (final inv in previous)
        if (inv.isProcessing) inv.id,
    };
    for (final inv in next) {
      if (!wasProcessing.contains(inv.id) || inv.isProcessing) continue;
      final notice = _terminalNotice(inv.status);
      if (notice != null) return notice;
    }
    return null;
  }

  // Notice text for a raw terminal status, or null for a status that shouldn't
  // interrupt (DISCARDED — user-initiated) or an unmapped/future status we can't
  // describe honestly. Branch on the raw status, never the display tone: an
  // unknown status maps to a processing-toned view and would otherwise be
  // mis-announced as a parse failure.
  static String? _terminalNotice(String status) => switch (status) {
        'PARSED' || 'NEEDS_REVIEW' => 'Receipt ready — tap it to review.',
        'SUSPECTED_DUPLICATE' => 'Looks like a duplicate — open it to confirm.',
        'FAILED_PROCESSING' =>
          'We couldn’t read your receipt — try a clearer photo.',
        _ => null,
      };

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
