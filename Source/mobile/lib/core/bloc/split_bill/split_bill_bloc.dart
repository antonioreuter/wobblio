import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/share_presenter.dart';
import 'package:wobblio/core/ports/split_id_cache.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/split_assignment.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

part 'split_bill_event.dart';
part 'split_bill_state.dart';

/// Owns the Split Bill screen (18h) — the most stateful of the mobile 18d–18h
/// slices. Ports `Source/webapp/src/components/workspace/use-bill-split.ts` +
/// `bill-split-dialog.tsx`'s interaction logic faithfully to bloc idioms:
/// fail-closed premium gate (mirrors `ShoppingListBloc`/`BudgetBloc`), the
/// split-id resolve-with-cache-fallback dance (`_resolveSplitId`, working
/// around `POST /invoices/{id}/splits`' lack of idempotency), and the
/// tap-to-assign/fraction-cycle state machine (`_onLineTapped`). Every
/// assignment mutation refetches `assignments`+`summary` from the backend —
/// the fee-pool-proportional-share math is server-only. Widgets stay
/// logic-free (`.claude/rules/flutter-architecture-guard.md`).
class SplitBillBloc extends Bloc<SplitBillEvent, SplitBillState> {
  SplitBillBloc({
    required ISplitRepository splits,
    required IInvoiceRepository invoices,
    required ISplitIdCache splitIdCache,
    required IProfileRepository profile,
    required ISharePresenter share,
    required this.invoiceId,
  })  : _splits = splits,
        _invoices = invoices,
        _splitIdCache = splitIdCache,
        _profile = profile,
        _share = share,
        super(const SplitBillState()) {
    on<SplitBillStarted>(_onStarted);
    on<SplitBillParticipantAdded>(_onParticipantAdded);
    on<SplitBillParticipantSelected>(_onParticipantSelected);
    on<SplitBillParticipantRemoved>(_onParticipantRemoved);
    on<SplitBillLineTapped>(_onLineTapped);
    on<SplitBillWhatsAppRequested>(_onWhatsAppRequested);
    on<SplitBillCopyRequested>(_onCopyRequested);
  }

  /// The synthetic implicit-remainder participant — never appears in
  /// [SplitBillState.participants], never PATCH-able as a real assignment
  /// (the backend rejects it with a 400).
  static const String you = 'You';

  static const List<double> _fractionCycle = [1, 0.5, 1 / 3];

  // bill_split_line.fraction is NUMERIC(5,4) — 1/3 round-trips through the
  // backend as 0.3333, not Dart's 0.3333333333333333 (diff ≈ 3.33e-5). The
  // tolerance must comfortably clear that DB-rounding gap while staying tight
  // enough that the three cycle values (1, 0.5, 1/3) never collide with each
  // other. Ported verbatim from `bill-split-dialog.tsx`'s `FRACTION_EPSILON`.
  static const double _fractionEpsilon = 1e-3;

  static const int _maxParticipantNameLength = 40;

  final ISplitRepository _splits;
  final IInvoiceRepository _invoices;
  final ISplitIdCache _splitIdCache;
  final IProfileRepository _profile;
  final ISharePresenter _share;
  final String invoiceId;

  Future<void> _onStarted(
    SplitBillStarted event,
    Emitter<SplitBillState> emit,
  ) async {
    emit(const SplitBillState());
    final isPremium = await _safeIsPremium();
    if (!isPremium) {
      emit(state.copyWith(status: SplitBillStatus.forbidden));
      return;
    }
    try {
      final splitId = await _resolveSplitId();
      // `Future.wait` subscribes to all three immediately, so they run
      // concurrently — an `await` on the first inline would block the others
      // from even starting, and holding a not-yet-awaited Future in a local
      // variable risks the zone flagging it as an unhandled rejection before
      // a later `await` gets to it.
      final results = await Future.wait<Object?>([
        _invoices.getDetail(invoiceId),
        _splits.getSplit(invoiceId, splitId),
        _splits.getSummary(invoiceId, splitId),
      ]);
      final detail = results[0]! as InvoiceDetail;
      final assignments = results[1]! as List<SplitAssignment>;
      final summary = results[2]! as SplitSummary;
      emit(
        state.copyWith(
          status: SplitBillStatus.ready,
          splitId: splitId,
          merchant: detail.merchant,
          total: detail.total,
          currency: detail.currency,
          transactionDate: detail.transactionDate,
          lines: _assignableLines(detail),
          participants: _distinctNames(assignments),
          assignments: assignments,
          summary: summary,
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: SplitBillStatus.failure));
    }
  }

  List<InvoiceLineDetail> _assignableLines(InvoiceDetail detail) => [
        for (final line in detail.lines)
          if (!line.isDiscount && !line.isDepositOrFee) line,
      ];

  // There is no "list splits for invoice" endpoint — POST always mints a new
  // split row. A cached id is validated with a GET; a 404 (or any other
  // failure) falls back to minting and caching a fresh one. Ports
  // `use-bill-split.ts`'s `resolveSplitId` exactly.
  Future<String> _resolveSplitId() async {
    final cached = await _splitIdCache.read(invoiceId);
    if (cached != null && await _isValidSplitId(cached)) return cached;
    final created = await _splits.createSplit(invoiceId);
    await _splitIdCache.write(invoiceId, created);
    return created;
  }

  Future<bool> _isValidSplitId(String splitId) async {
    try {
      await _splits.getSplit(invoiceId, splitId);
      return true;
    } catch (_) {
      return false;
    }
  }

  List<String> _distinctNames(List<SplitAssignment> assignments) {
    final names = <String>[];
    for (final assignment in assignments) {
      if (!names.contains(assignment.participantName)) {
        names.add(assignment.participantName);
      }
    }
    return names;
  }

  void _onParticipantAdded(
    SplitBillParticipantAdded event,
    Emitter<SplitBillState> emit,
  ) {
    var trimmed = event.name.trim();
    if (trimmed.length > _maxParticipantNameLength) {
      trimmed = trimmed.substring(0, _maxParticipantNameLength);
    }
    if (trimmed.isEmpty || trimmed.toLowerCase() == you.toLowerCase()) return;
    final alreadyKnown = state.participants
        .any((p) => p.toLowerCase() == trimmed.toLowerCase());
    emit(
      state.copyWith(
        participants:
            alreadyKnown ? state.participants : [...state.participants, trimmed],
        activeParticipant: trimmed,
      ),
    );
  }

  void _onParticipantSelected(
    SplitBillParticipantSelected event,
    Emitter<SplitBillState> emit,
  ) {
    emit(state.copyWith(activeParticipant: event.name));
  }

  // Optimistically drops the chip + reassigns the active participant back to
  // "You" if it was active, then unassigns every line the removed person
  // held. Always refreshes afterward (mirrors `removeParticipant`'s
  // Promise.all-then-refresh-then-throw shape); a notice + full local-list
  // revert only fires if one or more of the unassign calls actually failed.
  Future<void> _onParticipantRemoved(
    SplitBillParticipantRemoved event,
    Emitter<SplitBillState> emit,
  ) async {
    final name = event.name;
    final wasActive = state.activeParticipant == name;
    final previousParticipants = state.participants;
    emit(
      state.copyWith(
        participants: previousParticipants.where((p) => p != name).toList(),
        activeParticipant: wasActive ? you : state.activeParticipant,
        notice: null,
      ),
    );
    final splitId = state.splitId;
    if (splitId == null) return;
    final lineIds = [
      for (final assignment in state.assignments)
        if (assignment.participantName == name) assignment.lineId,
    ];
    final results = await Future.wait(
        [for (final lineId in lineIds) _tryUnassign(splitId, lineId)],);
    await _refreshSplitState(emit);
    if (results.any((ok) => !ok)) {
      emit(
        state.copyWith(
          participants: previousParticipants,
          activeParticipant: wasActive ? name : state.activeParticipant,
          notice: 'Couldn’t remove $name — please try again.',
        ),
      );
    }
  }

  Future<bool> _tryUnassign(String splitId, String lineId) async {
    try {
      await _splits.unassignLine(invoiceId, splitId, lineId);
      return true;
    } catch (_) {
      return false;
    }
  }

  // "You" is the synthetic implicit remainder owner, not a PATCH-able
  // participant — while active, a tap can only give a line back to you
  // (unassign), never cycle a fraction under a literal "You" assignment row.
  // Ports `bill-split-dialog.tsx`'s `handleLineTap` exactly.
  Future<void> _onLineTapped(
    SplitBillLineTapped event,
    Emitter<SplitBillState> emit,
  ) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    final assignment = state.assignmentFor(event.lineId);
    emit(state.copyWith(notice: null));
    try {
      await _applyLineTap(splitId, event.lineId, assignment);
      await _refreshSplitState(emit);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t update that line — please try again.',),);
    }
  }

  Future<void> _applyLineTap(
    String splitId,
    String lineId,
    SplitAssignment? assignment,
  ) async {
    if (state.activeParticipant == you) {
      if (assignment != null) await _splits.unassignLine(invoiceId, splitId, lineId);
      return;
    }
    if (assignment == null || assignment.participantName != state.activeParticipant) {
      await _splits.assignLine(invoiceId, splitId, lineId, state.activeParticipant);
      return;
    }
    final nextFraction = _nextFraction(assignment.fraction);
    if (nextFraction == null) {
      await _splits.unassignLine(invoiceId, splitId, lineId);
    } else {
      await _splits.assignLine(
          invoiceId, splitId, lineId, state.activeParticipant,
          fraction: nextFraction,);
    }
  }

  /// Null once the cycle runs past its end — the caller unassigns instead.
  static double? _nextFraction(double fraction) {
    final index = _fractionCycle
        .indexWhere((f) => (f - fraction).abs() < _fractionEpsilon);
    final nextIndex = index + 1;
    if (nextIndex >= _fractionCycle.length) return null;
    return _fractionCycle[nextIndex];
  }

  Future<void> _onWhatsAppRequested(
    SplitBillWhatsAppRequested event,
    Emitter<SplitBillState> emit,
  ) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    emit(state.copyWith(notice: null));
    try {
      final text = await _splits.getWhatsAppText(invoiceId, splitId);
      await _share.share(text);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t build the WhatsApp export — please try again.',),);
    }
  }

  Future<void> _onCopyRequested(
    SplitBillCopyRequested event,
    Emitter<SplitBillState> emit,
  ) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    emit(state.copyWith(notice: null));
    try {
      final text = await _splits.getWhatsAppText(invoiceId, splitId);
      await _share.copyToClipboard(text);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t copy the summary — please try again.',),);
    }
  }

  // Refetches assignments + summary from the backend and grows (never
  // shrinks) [SplitBillState.participants] with any newly-observed names —
  // the fee-pool math and the assignment set of record both live server-side.
  Future<void> _refreshSplitState(Emitter<SplitBillState> emit) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    final assignments = await _splits.getSplit(invoiceId, splitId);
    final summary = await _splits.getSummary(invoiceId, splitId);
    emit(
      state.copyWith(
        assignments: assignments,
        summary: summary,
        participants: _growParticipants(state.participants, assignments),
      ),
    );
  }

  List<String> _growParticipants(
      List<String> current, List<SplitAssignment> assignments,) {
    final grown = [...current];
    for (final name in _distinctNames(assignments)) {
      if (!grown.contains(name)) grown.add(name);
    }
    return grown;
  }

  Future<bool> _safeIsPremium() async {
    try {
      final profile = await _profile.fetchProfile();
      return profile.role != 'STANDARD';
    } catch (_) {
      return false; // fail closed — the upsell card is always a safe fallback
    }
  }
}
