import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/share_presenter.dart';
import 'package:wobblio/core/ports/split_id_cache.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/split_allocation.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

part 'split_bill_event.dart';
part 'split_bill_state.dart';

/// Owns the Split Bill screen (18h) — the most stateful of the mobile 18d–18h
/// slices. Ports `Source/webapp/src/components/workspace/use-bill-split.ts` +
/// `bill-split-dialog.tsx`'s interaction logic faithfully to bloc idioms:
/// fail-closed premium gate (mirrors `ShoppingListBloc`/`BudgetBloc`), the
/// split-id resolve-with-cache-fallback dance (`_resolveSplitId`, working
/// around `POST /invoices/{id}/splits`' lack of idempotency), and the
/// units-based assignment state machine — multi-unit lines step with `+/−`
/// (`_stepUnits`), single-unit lines tap-cycle `[1, ½, ⅓]` (`_cycleShare`).
/// Every mutation replaces a line's whole allocation set then refetches
/// `allocations`+`summary` — the fee-pool-proportional-share math is
/// server-only. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
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
    on<SplitBillLineStepped>(_onLineStepped);
    on<SplitBillLineReset>(_onLineReset);
    on<SplitBillShareLinkRequested>(_onShareLinkRequested);
    on<SplitBillWhatsAppRequested>(_onWhatsAppRequested);
    on<SplitBillCopyRequested>(_onCopyRequested);
  }

  /// The synthetic implicit-remainder participant — never appears in
  /// [SplitBillState.participants], never allocatable as a real assignment
  /// (the backend rejects it with a 400).
  static const String you = 'You';

  static const List<double> _fractionCycle = [1, 0.5, 1 / 3];

  // bill_split_line.units is NUMERIC(9,4) — 1/3 round-trips through the backend
  // as 0.3333, not Dart's 0.3333333333333333 (diff ≈ 3.33e-5). The tolerance
  // must comfortably clear that DB-rounding gap while staying tight enough that
  // the three cycle values (1, 0.5, 1/3) never collide with each other. Ported
  // verbatim from `bill-split-dialog.tsx`'s `EPSILON`.
  static const double _epsilon = 1e-3;

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
      final allocations = results[1]! as List<SplitAllocation>;
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
          participants: _distinctNames(allocations),
          allocations: allocations,
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

  List<String> _distinctNames(List<SplitAllocation> allocations) {
    final names = <String>[];
    for (final allocation in allocations) {
      if (!names.contains(allocation.participantName)) {
        names.add(allocation.participantName);
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
  // "You" if it was active, then strips the removed person from every line they
  // held by re-committing that line's remaining allocations. Always refreshes
  // afterward (mirrors `removeParticipant`'s Promise.all-then-refresh-then-throw
  // shape); a notice + full local-list revert only fires if one or more of the
  // re-commit calls actually failed.
  Future<void> _onParticipantRemoved(
    SplitBillParticipantRemoved event,
    Emitter<SplitBillState> emit,
  ) async {
    final name = event.name;
    final wasActive = state.activeParticipant == name;
    final previousParticipants = state.participants;
    final lineIds = {
      for (final a in state.allocations)
        if (a.participantName == name) a.lineId,
    };
    final kept = {
      for (final lineId in lineIds) lineId: _othersOf(lineId, name),
    };
    emit(
      state.copyWith(
        participants: previousParticipants.where((p) => p != name).toList(),
        activeParticipant: wasActive ? you : state.activeParticipant,
        notice: null,
      ),
    );
    final splitId = state.splitId;
    if (splitId == null) return;
    final results = await Future.wait([
      for (final entry in kept.entries)
        _tryCommit(splitId, entry.key, entry.value),
    ]);
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

  // "You" is the synthetic implicit remainder owner, not an allocatable
  // participant — while active, a single-unit tap can only give the line back
  // to you (clear its allocations). Ports `bill-split-dialog.tsx`'s
  // `cycleShare`/`resetLine` split for single-unit lines.
  Future<void> _onLineTapped(
    SplitBillLineTapped event,
    Emitter<SplitBillState> emit,
  ) async {
    final line = _lineById(event.lineId);
    if (line == null) return;
    if (state.activeParticipant == you) {
      await _resetLine(emit, line);
      return;
    }
    await _cycleShare(emit, line);
  }

  Future<void> _onLineStepped(
    SplitBillLineStepped event,
    Emitter<SplitBillState> emit,
  ) async {
    final line = _lineById(event.lineId);
    if (line == null || state.activeParticipant == you) return;
    await _stepUnits(emit, line, event.delta);
  }

  Future<void> _onLineReset(
    SplitBillLineReset event,
    Emitter<SplitBillState> emit,
  ) async {
    final line = _lineById(event.lineId);
    if (line == null) return;
    await _resetLine(emit, line);
  }

  // Multi-unit lines: nudge the active participant's unit count, capped by
  // what's left after the other owners. Ports `stepUnits`.
  Future<void> _stepUnits(
    Emitter<SplitBillState> emit,
    InvoiceLineDetail line,
    int delta,
  ) async {
    final active = state.activeParticipant;
    final others = _othersOf(line.id, active);
    final otherUnits = others.fold<double>(0, (sum, a) => sum + a.units);
    final capacity = line.quantity - otherUnits;
    final next =
        (state.unitsFor(line.id, active) + delta).clamp(0.0, capacity);
    await _commit(emit, line.id, [
      ...others,
      if (next > _epsilon)
        LineAllocation(participantName: active, units: next),
    ]);
  }

  // Single-unit lines keep the tap-to-cycle share: assign in full, then ½, ⅓,
  // then release. One owner at a time (remainder → You), so this replaces the
  // set. Ports `cycleShare`.
  Future<void> _cycleShare(
    Emitter<SplitBillState> emit,
    InvoiceLineDetail line,
  ) async {
    final active = state.activeParticipant;
    final owns =
        state.allocationsFor(line.id).any((a) => a.participantName == active);
    if (!owns) {
      await _commit(
          emit, line.id, [LineAllocation(participantName: active, units: 1)],);
      return;
    }
    final mine = state.unitsFor(line.id, active);
    final index =
        _fractionCycle.indexWhere((f) => (f - mine).abs() < _epsilon);
    final nextIndex = index + 1;
    final next =
        nextIndex < _fractionCycle.length ? _fractionCycle[nextIndex] : 0.0;
    await _commit(
      emit,
      line.id,
      next > _epsilon
          ? [LineAllocation(participantName: active, units: next)]
          : const [],
    );
  }

  Future<void> _resetLine(
    Emitter<SplitBillState> emit,
    InvoiceLineDetail line,
  ) async {
    if (state.allocationsFor(line.id).isEmpty) return;
    await _commit(emit, line.id, const []);
  }

  List<LineAllocation> _othersOf(String lineId, String name) => [
        for (final a in state.allocationsFor(lineId))
          if (a.participantName != name)
            LineAllocation(participantName: a.participantName, units: a.units),
      ];

  InvoiceLineDetail? _lineById(String lineId) {
    for (final line in state.lines) {
      if (line.id == lineId) return line;
    }
    return null;
  }

  // Replace a line's whole allocation set, then refetch — every split gesture
  // reduces to "here is the new set for this line".
  Future<void> _commit(
    Emitter<SplitBillState> emit,
    String lineId,
    List<LineAllocation> allocations,
  ) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    emit(state.copyWith(notice: null));
    try {
      await _splits.setLineAllocations(invoiceId, splitId, lineId, allocations);
      await _refreshSplitState(emit);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t update that line — please try again.',),);
    }
  }

  Future<bool> _tryCommit(
    String splitId,
    String lineId,
    List<LineAllocation> allocations,
  ) async {
    try {
      await _splits.setLineAllocations(invoiceId, splitId, lineId, allocations);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _onShareLinkRequested(
    SplitBillShareLinkRequested event,
    Emitter<SplitBillState> emit,
  ) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    emit(state.copyWith(notice: null));
    try {
      final url = await _splits.createShareLink(invoiceId, splitId);
      emit(state.copyWith(shareUrl: url));
      await _share.share(url);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t create a share link — please try again.',),);
    }
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

  // Refetches allocations + summary from the backend and grows (never
  // shrinks) [SplitBillState.participants] with any newly-observed names —
  // the fee-pool math and the allocation set of record both live server-side.
  Future<void> _refreshSplitState(Emitter<SplitBillState> emit) async {
    final splitId = state.splitId;
    if (splitId == null) return;
    final allocations = await _splits.getSplit(invoiceId, splitId);
    final summary = await _splits.getSummary(invoiceId, splitId);
    emit(
      state.copyWith(
        allocations: allocations,
        summary: summary,
        participants: _growParticipants(state.participants, allocations),
      ),
    );
  }

  List<String> _growParticipants(
      List<String> current, List<SplitAllocation> allocations,) {
    final grown = [...current];
    for (final name in _distinctNames(allocations)) {
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
