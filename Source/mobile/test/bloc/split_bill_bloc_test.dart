import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/split_bill/split_bill_bloc.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/share_presenter.dart';
import 'package:wobblio/core/ports/split_id_cache.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/shared_split.dart';
import 'package:wobblio/core/splitting/split_allocation.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
InvoiceLineDetail _line(
  String id,
  String text,
  double total, {
  double quantity = 1,
  bool isDiscount = false,
  bool isDepositOrFee = false,
}) =>
    InvoiceLineDetail(
      id: id,
      rawText: text,
      productId: null,
      quantity: quantity,
      unitPrice: total,
      lineTotal: total,
      categoryName: null,
      confidence: 1,
      isDiscount: isDiscount,
      isDepositOrFee: isDepositOrFee,
    );

InvoiceDetail _detailFixture({List<InvoiceLineDetail>? lines}) => InvoiceDetail(
      id: 'inv-1',
      merchant: 'AH To Go',
      status: 'PARSED',
      transactionDate: '2026-06-30',
      total: 10,
      currency: 'EUR',
      imageUrl: null,
      lines: lines ??
          [
            _line('l1', 'Bananen', 3),
            _line('l2', 'Statiegeld', 1, isDepositOrFee: true),
            _line('l3', 'Korting', -1, isDiscount: true),
          ],
    );

// A single multi-quantity product line (qty 3) for the +/− stepper tests.
InvoiceDetail _multiDetailFixture() =>
    _detailFixture(lines: [_line('l1', '3× Cola', 9, quantity: 3)]);

UserProfile _profile(String role) =>
    UserProfile(onboarded: true, fullName: 'Anna', role: role, status: 'ACTIVE');

SplitSummary _summaryFixture({List<SplitParticipant>? participants, double grandTotal = 10}) =>
    SplitSummary(participants: participants ?? const [], grandTotal: grandTotal);

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeInvoices implements IInvoiceRepository {
  _FakeInvoices({InvoiceDetail? detail, this.loadError = false})
      : _detail = detail ?? _detailFixture();

  final InvoiceDetail _detail;
  final bool loadError;

  @override
  Future<InvoiceDetail> getDetail(String invoiceId) async {
    if (loadError) throw Exception('boom');
    return _detail;
  }

  @override
  Future<void> delete(String invoiceId) => throw UnimplementedError();

  @override
  Future<ShareLink> createShare(String invoiceId) => throw UnimplementedError();

  @override
  Future<void> recordFeedback(String invoiceId, FeedbackVerdict verdict) =>
      throw UnimplementedError();

  @override
  Future<List<InvoiceSummary>> list() => throw UnimplementedError();
}

class _FakeProfile implements IProfileRepository {
  _FakeProfile(this.role, {this.fails = false});
  final String role;
  final bool fails;

  @override
  Future<UserProfile> fetchProfile() async {
    if (fails) throw Exception('boom');
    return _profile(role);
  }
}

class _FakeSplitIdCache implements ISplitIdCache {
  _FakeSplitIdCache({String? seeded}) : _stored = seeded;
  String? _stored;
  int writes = 0;

  @override
  Future<String?> read(String invoiceId) async => _stored;

  @override
  Future<void> write(String invoiceId, String splitId) async {
    _stored = splitId;
    writes++;
  }
}

class _FakeShare implements ISharePresenter {
  final List<String> shared = [];
  final List<String> copied = [];

  @override
  Future<void> share(String text) async => shared.add(text);

  @override
  Future<void> copyToClipboard(String text) async => copied.add(text);
}

class _FakeSplits implements ISplitRepository {
  _FakeSplits({
    Set<String>? validSplitIds,
    this.createdId = 'split-created',
    this.summary,
    this.setError = false,
    this.getSplitError = false,
    this.shareUrl = 'https://wobblio.app/s/tok123',
    this.shareError = false,
    Map<String, List<SplitAllocation>>? seedAllocations,
  })  : // A fresh, mutable copy — `createSplit` below grows this set, and a
        // `const` default (or a caller-passed literal) would throw on `.add`.
        validSplitIds = {...(validSplitIds ?? const {'split-1'})},
        _allocations = {...?seedAllocations};

  final Set<String> validSplitIds;
  final String createdId;
  SplitSummary? summary;
  final bool setError;
  final bool getSplitError;
  final String shareUrl;
  final bool shareError;

  int createCalls = 0;
  int createShareCalls = 0;
  final List<String> getSplitCalls = [];
  final List<(String, List<LineAllocation>)> setCalls = [];

  /// Mutable in-memory allocation set (lineId → its allocations) so getSplit
  /// reflects prior setLineAllocations calls, letting the cycle/stepper tests
  /// read back what the previous mutation wrote. May carry several allocations
  /// per line (multiple participants sharing a multi-unit line).
  final Map<String, List<SplitAllocation>> _allocations;

  @override
  Future<String> createSplit(String invoiceId) async {
    createCalls++;
    validSplitIds.add(createdId);
    return createdId;
  }

  @override
  Future<List<SplitAllocation>> getSplit(String invoiceId, String splitId) async {
    getSplitCalls.add(splitId);
    if (getSplitError) throw const ApiException('boom', statusCode: 500);
    if (!validSplitIds.contains(splitId)) {
      throw const ApiException('not found', statusCode: 404);
    }
    return [for (final list in _allocations.values) ...list];
  }

  @override
  Future<void> setLineAllocations(
    String invoiceId,
    String splitId,
    String lineId,
    List<LineAllocation> allocations,
  ) async {
    setCalls.add((lineId, allocations));
    if (setError) throw Exception('boom');
    if (allocations.isEmpty) {
      _allocations.remove(lineId);
      return;
    }
    _allocations[lineId] = [
      for (final a in allocations)
        SplitAllocation(
            lineId: lineId, participantName: a.participantName, units: a.units,),
    ];
  }

  @override
  Future<SplitSummary> getSummary(String invoiceId, String splitId) async =>
      summary ?? _summaryFixture();

  @override
  Future<String> getWhatsAppText(String invoiceId, String splitId) async =>
      'Split summary text';

  @override
  Future<String> createShareLink(String invoiceId, String splitId) async {
    createShareCalls++;
    if (shareError) throw const ApiException('boom', statusCode: 500);
    return shareUrl;
  }

  @override
  Future<SharedSplit> getSharedSplit(String token) => throw UnimplementedError();
}

SplitBillBloc _build({
  _FakeSplits? splits,
  _FakeInvoices? invoices,
  _FakeSplitIdCache? cache,
  _FakeProfile? profile,
  _FakeShare? share,
}) =>
    SplitBillBloc(
      splits: splits ?? _FakeSplits(),
      invoices: invoices ?? _FakeInvoices(),
      splitIdCache: cache ?? _FakeSplitIdCache(),
      profile: profile ?? _FakeProfile('PREMIUM'),
      share: share ?? _FakeShare(),
      invoiceId: 'inv-1',
    );

void main() {
  group('SplitBillBloc', () {
    blocTest<SplitBillBloc, SplitBillState>(
      'non-premium account never attempts the split flow',
      build: () => _build(
        profile: _FakeProfile('STANDARD'),
        splits: _FakeSplits(),
      ),
      act: (bloc) => bloc.add(const SplitBillStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, SplitBillStatus.forbidden);
      },
    );

    test('non-premium account issues no split repository calls', () async {
      final splits = _FakeSplits();
      final bloc = _build(profile: _FakeProfile('STANDARD'), splits: splits);
      bloc.add(const SplitBillStarted());
      await Future<void>.delayed(Duration.zero);
      expect(splits.createCalls, 0);
      expect(splits.getSplitCalls, isEmpty);
      await bloc.close();
    });

    test('a profile-fetch failure fails closed to forbidden (no split calls attempted)',
        () async {
      final splits = _FakeSplits();
      final bloc =
          _build(profile: _FakeProfile('PREMIUM', fails: true), splits: splits);
      bloc.add(const SplitBillStarted());
      await Future<void>.delayed(Duration.zero);
      expect(bloc.state.status, SplitBillStatus.forbidden);
      expect(splits.createCalls, 0);
      expect(splits.getSplitCalls, isEmpty);
      await bloc.close();
    });

    blocTest<SplitBillBloc, SplitBillState>(
      'a cached, still-valid split id is reused — no create call',
      build: () => _build(
        cache: _FakeSplitIdCache(seeded: 'split-1'),
        splits: _FakeSplits(validSplitIds: {'split-1'}),
      ),
      act: (bloc) => bloc.add(const SplitBillStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, SplitBillStatus.ready);
        expect(bloc.state.splitId, 'split-1');
      },
    );

    test('a cached but stale (404) split id falls back to creating a fresh one', () async {
      final splits = _FakeSplits(validSplitIds: {}, createdId: 'split-fresh');
      final cache = _FakeSplitIdCache(seeded: 'split-stale');
      final bloc = _build(cache: cache, splits: splits);
      bloc.add(const SplitBillStarted());
      await Future<void>.delayed(Duration.zero);
      expect(splits.createCalls, 1);
      expect(bloc.state.splitId, 'split-fresh');
      expect(cache.writes, 1);
      await bloc.close();
    });

    test('a cached split id whose validation GET fails generically (not just 404) '
        'also falls back to creating a fresh one', () async {
      final splits = _FakeSplits(
          validSplitIds: {'split-1'}, getSplitError: true, createdId: 'split-fresh',);
      final cache = _FakeSplitIdCache(seeded: 'split-1');
      final bloc = _build(cache: cache, splits: splits);
      bloc.add(const SplitBillStarted());
      await Future<void>.delayed(Duration.zero);
      expect(splits.createCalls, 1);
      expect(cache.writes, 1);
      await bloc.close();
    });

    test('no cached split id creates and caches a fresh one', () async {
      final splits = _FakeSplits(validSplitIds: {}, createdId: 'split-new');
      final cache = _FakeSplitIdCache();
      final bloc = _build(cache: cache, splits: splits);
      bloc.add(const SplitBillStarted());
      await Future<void>.delayed(Duration.zero);
      expect(splits.createCalls, 1);
      expect(bloc.state.splitId, 'split-new');
      expect(cache.writes, 1);
      await bloc.close();
    });

    blocTest<SplitBillBloc, SplitBillState>(
      'started filters out discount and deposit-or-fee lines',
      build: _build,
      act: (bloc) => bloc.add(const SplitBillStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.lines.map((l) => l.id).toList(), ['l1']);
      },
    );

    blocTest<SplitBillBloc, SplitBillState>(
      'load failure surfaces a failure status',
      build: () => _build(invoices: _FakeInvoices(loadError: true)),
      act: (bloc) => bloc.add(const SplitBillStarted()),
      skip: 1,
      expect: () => [
        isA<SplitBillState>().having((s) => s.status, 'status', SplitBillStatus.failure),
      ],
    );

    group('single-unit tap-cycle state machine', () {
      test('You active + unassigned line → no-op (nothing to clear)', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        expect(splits.setCalls, isEmpty);
        await bloc.close();
      });

      test('non-You active + unassigned line → assigns 1 unit', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        expect(splits.setCalls.single.$1, 'l1');
        expect(splits.setCalls.single.$2,
            [const LineAllocation(participantName: 'Sam', units: 1)],);
        expect(bloc.state.unitsFor('l1', 'Sam'), 1);
        await bloc.close();
      });

      test('full walk: unassigned → 1 → ½ → ⅓ → clear', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);

        bloc.add(const SplitBillLineTapped('l1')); // → 1
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Sam'), 1);

        bloc.add(const SplitBillLineTapped('l1')); // → ½
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Sam'), 0.5);

        bloc.add(const SplitBillLineTapped('l1')); // → ⅓
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Sam'), closeTo(1 / 3, 1e-9));

        bloc.add(const SplitBillLineTapped('l1')); // → clear
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.allocationsFor('l1'), isEmpty);
        expect(splits.setCalls.last.$1, 'l1');
        expect(splits.setCalls.last.$2, isEmpty);
        await bloc.close();
      });

      test(
          'a NUMERIC(9,4) round-tripped 0.3333 (not exact 1/3) still matches '
          'the ⅓ cycle index — next tap clears, not restarts at 1', () async {
        final splits = _FakeSplits(
          seedAllocations: {
            'l1': const [
              SplitAllocation(lineId: 'l1', participantName: 'Sam', units: 0.3333),
            ],
          },
        );
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Sam'), 0.3333);
        bloc.add(const SplitBillParticipantSelected('Sam'));
        await Future<void>.delayed(Duration.zero);

        bloc.add(const SplitBillLineTapped('l1')); // ⅓ → past the end → clear
        await Future<void>.delayed(Duration.zero);

        expect(splits.setCalls.last.$1, 'l1');
        expect(splits.setCalls.last.$2, isEmpty);
        expect(bloc.state.allocationsFor('l1'), isEmpty);
        await bloc.close();
      });

      test('You active + assigned line → clears the set, never re-assigns', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1')); // Sam takes it
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantSelected(SplitBillBloc.you));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1')); // You active → clear
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.allocationsFor('l1'), isEmpty);
        expect(splits.setCalls.last.$1, 'l1');
        expect(splits.setCalls.last.$2, isEmpty);
        await bloc.close();
      });

      test('tapping a line owned by a different participant reassigns it at 1 unit',
          () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1')); // Sam takes it at 1
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Zoe'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1')); // Zoe steals it at 1
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Zoe'), 1);
        expect(bloc.state.unitsFor('l1', 'Sam'), 0);
        await bloc.close();
      });

      test('a line-tap failure surfaces a notice', () async {
        final splits = _FakeSplits(setError: true);
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(bloc.state.notice, isNotNull);
        await bloc.close();
      });
    });

    group('multi-unit +/− stepper', () {
      test('+ assigns a unit to the active participant, keeping other owners', () async {
        final splits = _FakeSplits(
          seedAllocations: {
            'l1': const [
              SplitAllocation(lineId: 'l1', participantName: 'Sam', units: 1),
            ],
          },
        );
        final bloc = _build(
            splits: splits, invoices: _FakeInvoices(detail: _multiDetailFixture()),);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Zoe'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineStepped('l1', 1)); // Zoe +1
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Zoe'), 1);
        expect(bloc.state.unitsFor('l1', 'Sam'), 1);
        await bloc.close();
      });

      test('+ is capped at the units left after the other owners', () async {
        final splits = _FakeSplits(
          seedAllocations: {
            'l1': const [
              SplitAllocation(lineId: 'l1', participantName: 'Sam', units: 2),
            ],
          },
        );
        final bloc = _build(
            splits: splits, invoices: _FakeInvoices(detail: _multiDetailFixture()),);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Zoe'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineStepped('l1', 1)); // Zoe +1 → 1 (cap 3-2)
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineStepped('l1', 1)); // capped, stays 1
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Zoe'), 1);
        await bloc.close();
      });

      test('− decrements and drops the participant off the line at zero', () async {
        final splits = _FakeSplits(
          seedAllocations: {
            'l1': const [
              SplitAllocation(lineId: 'l1', participantName: 'Zoe', units: 1),
            ],
          },
        );
        final bloc = _build(
            splits: splits, invoices: _FakeInvoices(detail: _multiDetailFixture()),);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantSelected('Zoe'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineStepped('l1', -1)); // Zoe 1 → 0
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.unitsFor('l1', 'Zoe'), 0);
        expect(bloc.state.allocationsFor('l1'), isEmpty);
        await bloc.close();
      });

      test('reset clears every allocation on the line', () async {
        final splits = _FakeSplits(
          seedAllocations: {
            'l1': const [
              SplitAllocation(lineId: 'l1', participantName: 'Sam', units: 1),
              SplitAllocation(lineId: 'l1', participantName: 'Zoe', units: 1),
            ],
          },
        );
        final bloc = _build(
            splits: splits, invoices: _FakeInvoices(detail: _multiDetailFixture()),);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineReset('l1'));
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.allocationsFor('l1'), isEmpty);
        expect(splits.setCalls.last.$1, 'l1');
        expect(splits.setCalls.last.$2, isEmpty);
        await bloc.close();
      });
    });

    group('mutations refetch allocations+summary rather than recompute', () {
      test('a successful line tap ends up with the canned post-mutation summary', () async {
        final cannedSummary = _summaryFixture(
          participants: const [
            SplitParticipant(
                name: 'Sam', subtotal: 3, fees: 0.5, total: 3.5, items: [],),
          ],
          grandTotal: 3.5,
        );
        final splits = _FakeSplits(summary: cannedSummary);
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.summary, cannedSummary);
        await bloc.close();
      });
    });

    group('participant add', () {
      blocTest<SplitBillBloc, SplitBillState>(
        'trims, caps at 40 chars, and sets active participant',
        build: _build,
        act: (bloc) async {
          bloc.add(const SplitBillStarted());
          await Future<void>.delayed(Duration.zero);
          bloc.add(SplitBillParticipantAdded('  ${'A' * 50}  '));
        },
        skip: 1,
        verify: (bloc) {
          expect(bloc.state.participants.single.length, 40);
          expect(bloc.state.activeParticipant.length, 40);
        },
      );

      blocTest<SplitBillBloc, SplitBillState>(
        'rejects an empty (post-trim) name',
        build: _build,
        act: (bloc) async {
          bloc.add(const SplitBillStarted());
          await Future<void>.delayed(Duration.zero);
          bloc.add(const SplitBillParticipantAdded('   '));
        },
        skip: 1,
        verify: (bloc) => expect(bloc.state.participants, isEmpty),
      );

      blocTest<SplitBillBloc, SplitBillState>(
        'rejects "you" case-insensitively',
        build: _build,
        act: (bloc) async {
          bloc.add(const SplitBillStarted());
          await Future<void>.delayed(Duration.zero);
          bloc.add(const SplitBillParticipantAdded('yOu'));
        },
        skip: 1,
        verify: (bloc) => expect(bloc.state.participants, isEmpty),
      );

      blocTest<SplitBillBloc, SplitBillState>(
        'dedupes case-insensitively without adding a second chip',
        build: _build,
        act: (bloc) async {
          bloc.add(const SplitBillStarted());
          await Future<void>.delayed(Duration.zero);
          bloc.add(const SplitBillParticipantAdded('Sam'));
          await Future<void>.delayed(Duration.zero);
          bloc.add(const SplitBillParticipantAdded('sam'));
        },
        skip: 2,
        verify: (bloc) => expect(bloc.state.participants, ['Sam']),
      );
    });

    group('participant remove', () {
      test('strips them from every line they held and reassigns active back to You',
          () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantRemoved('Sam'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(bloc.state.participants, isNot(contains('Sam')));
        expect(bloc.state.activeParticipant, SplitBillBloc.you);
        // Sam was the sole owner of l1 → the line is re-committed empty.
        expect(splits.setCalls.last.$1, 'l1');
        expect(splits.setCalls.last.$2, isEmpty);
        expect(bloc.state.allocationsFor('l1'), isEmpty);
        await bloc.close();
      });

      test('reverts the local participant list on failure', () async {
        // Sam is seeded owning l1 (so participants seeds to [Sam] on load), and
        // every setLineAllocations fails — so the remove's re-commit throws and
        // the optimistic chip drop is reverted with a notice.
        final bloc = _build(splits: _FailingOnSetSplits());
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.participants, contains('Sam'));
        bloc.add(const SplitBillParticipantRemoved('Sam'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(bloc.state.participants, contains('Sam'));
        expect(bloc.state.notice, isNotNull);
        await bloc.close();
      });
    });

    group('share link', () {
      test('SplitBillShareLinkRequested mints a link, stores it, and shares it', () async {
        final share = _FakeShare();
        final splits = _FakeSplits(shareUrl: 'https://wobblio.app/s/abc');
        final bloc = _build(splits: splits, share: share);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillShareLinkRequested());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(splits.createShareCalls, 1);
        expect(bloc.state.shareUrl, 'https://wobblio.app/s/abc');
        expect(share.shared, ['https://wobblio.app/s/abc']);
        await bloc.close();
      });

      test('a share-link failure surfaces a notice and leaves shareUrl null', () async {
        final splits = _FakeSplits(shareError: true);
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillShareLinkRequested());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(bloc.state.shareUrl, isNull);
        expect(bloc.state.notice, isNotNull);
        await bloc.close();
      });
    });

    group('WhatsApp share and copy', () {
      test('WhatsApp requested calls ISharePresenter.share with the backend text', () async {
        final share = _FakeShare();
        final bloc = _build(share: share);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillWhatsAppRequested());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(share.shared, ['Split summary text']);
        expect(share.copied, isEmpty);
        await bloc.close();
      });

      test('Copy requested calls ISharePresenter.copyToClipboard with the backend text',
          () async {
        final share = _FakeShare();
        final bloc = _build(share: share);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillCopyRequested());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(share.copied, ['Split summary text']);
        expect(share.shared, isEmpty);
        await bloc.close();
      });
    });
  });
}

// A variant whose setLineAllocations always fails — used to exercise the
// participant-remove revert path (the initial state seeds Sam owning l1 so the
// remove has a line to re-commit).
class _FailingOnSetSplits extends _FakeSplits {
  _FailingOnSetSplits()
      : super(
          seedAllocations: {
            'l1': const [
              SplitAllocation(lineId: 'l1', participantName: 'Sam', units: 1),
            ],
          },
        );

  @override
  Future<void> setLineAllocations(
    String invoiceId,
    String splitId,
    String lineId,
    List<LineAllocation> allocations,
  ) async {
    setCalls.add((lineId, allocations));
    throw Exception('boom');
  }
}
