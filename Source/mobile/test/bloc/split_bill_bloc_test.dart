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
import 'package:wobblio/core/splitting/split_assignment.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
InvoiceLineDetail _line(
  String id,
  String text,
  double total, {
  bool isDiscount = false,
  bool isDepositOrFee = false,
}) =>
    InvoiceLineDetail(
      id: id,
      rawText: text,
      productId: null,
      quantity: 1,
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
    this.assignLineError = false,
    this.unassignLineError = false,
    this.getSplitError = false,
    Map<String, SplitAssignment>? seedAssignments,
  })  : // A fresh, mutable copy — `createSplit` below grows this set, and a
        // `const` default (or a caller-passed literal) would throw on `.add`.
        validSplitIds = {...(validSplitIds ?? const {'split-1'})},
        _assignments = {...?seedAssignments};

  final Set<String> validSplitIds;
  final String createdId;
  SplitSummary? summary;
  final bool assignLineError;
  final bool unassignLineError;
  final bool getSplitError;

  int createCalls = 0;
  final List<String> getSplitCalls = [];
  final List<(String, double)> assignCalls = [];
  final List<String> unassignCalls = [];

  /// Mutable in-memory assignment set so getSplit reflects prior
  /// assign/unassign calls, letting the fraction-cycle tests read back what
  /// the previous tap wrote. May be pre-seeded to simulate a fraction
  /// already round-tripped through the backend's `NUMERIC(5,4)` column.
  final Map<String, SplitAssignment> _assignments;

  @override
  Future<String> createSplit(String invoiceId) async {
    createCalls++;
    validSplitIds.add(createdId);
    return createdId;
  }

  @override
  Future<List<SplitAssignment>> getSplit(String invoiceId, String splitId) async {
    getSplitCalls.add(splitId);
    if (getSplitError) throw const ApiException('boom', statusCode: 500);
    if (!validSplitIds.contains(splitId)) {
      throw const ApiException('not found', statusCode: 404);
    }
    return _assignments.values.toList();
  }

  @override
  Future<void> assignLine(
    String invoiceId,
    String splitId,
    String lineId,
    String participantName, {
    double fraction = 1,
  }) async {
    assignCalls.add((lineId, fraction));
    if (assignLineError) throw Exception('boom');
    _assignments[lineId] =
        SplitAssignment(lineId: lineId, participantName: participantName, fraction: fraction);
  }

  @override
  Future<void> unassignLine(String invoiceId, String splitId, String lineId) async {
    unassignCalls.add(lineId);
    if (unassignLineError) throw Exception('boom');
    _assignments.remove(lineId);
  }

  @override
  Future<SplitSummary> getSummary(String invoiceId, String splitId) async =>
      summary ?? _summaryFixture();

  @override
  Future<String> getWhatsAppText(String invoiceId, String splitId) async =>
      'Split summary text';
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

    test('a cached, still-valid split id issues no create call', () async {
      final splits = _FakeSplits(validSplitIds: {'split-1'});
      final bloc = _build(cache: _FakeSplitIdCache(seeded: 'split-1'), splits: splits);
      bloc.add(const SplitBillStarted());
      await Future<void>.delayed(Duration.zero);
      expect(splits.createCalls, 0);
      await bloc.close();
    });

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
      // getSplitError makes every getSplit call throw, so the ready state
      // never lands — assert the fallback create still happened.
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

    group('fraction-cycle state machine (handleLineTap)', () {
      test('You active + unassigned line → no-op (nothing to unassign)', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        expect(splits.unassignCalls, isEmpty);
        expect(splits.assignCalls, isEmpty);
        await bloc.close();
      });

      test('non-You active + unassigned line → assigns at fraction 1', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        expect(splits.assignCalls, [('l1', 1.0)]);
        expect(bloc.state.assignmentFor('l1')?.participantName, 'Sam');
        await bloc.close();
      });

      test('full walk: unassigned → 1 → ½ → ⅓ → unassign', () async {
        final splits = _FakeSplits();
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);

        bloc.add(const SplitBillLineTapped('l1')); // → 1
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.assignmentFor('l1')?.fraction, 1);

        bloc.add(const SplitBillLineTapped('l1')); // → ½
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.assignmentFor('l1')?.fraction, 0.5);

        bloc.add(const SplitBillLineTapped('l1')); // → ⅓
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.assignmentFor('l1')?.fraction, closeTo(1 / 3, 1e-9));

        bloc.add(const SplitBillLineTapped('l1')); // → unassign
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.assignmentFor('l1'), isNull);
        expect(splits.unassignCalls, contains('l1'));

        await bloc.close();
      });

      test(
          'a NUMERIC(5,4) round-tripped 0.3333 (not exact 1/3) still matches '
          'the ⅓ cycle index — next tap unassigns, not restarts at 1', () async {
        // Simulates the backend echoing back 0.3333 (its NUMERIC(5,4) rounding
        // of 1/3) rather than Dart's literal 0.3333333333333333 — the epsilon
        // tolerance must still resolve this to cycle index 2 (⅓) so the next
        // tap correctly unassigns instead of misreading it as "no match" and
        // restarting the cycle at fraction 1.
        final splits = _FakeSplits(
          seedAssignments: {
            'l1': const SplitAssignment(
                lineId: 'l1', participantName: 'Sam', fraction: 0.3333,),
          },
        );
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.assignmentFor('l1')?.fraction, 0.3333);
        bloc.add(const SplitBillParticipantSelected('Sam'));
        await Future<void>.delayed(Duration.zero);

        bloc.add(const SplitBillLineTapped('l1')); // ⅓ → past the end → unassign
        await Future<void>.delayed(Duration.zero);

        expect(splits.unassignCalls, contains('l1'));
        expect(splits.assignCalls, isEmpty);
        expect(bloc.state.assignmentFor('l1'), isNull);
        await bloc.close();
      });

      test('You active + assigned line → unassign only, never PATCH', () async {
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
        bloc.add(const SplitBillLineTapped('l1')); // You active → unassign only
        await Future<void>.delayed(Duration.zero);
        expect(splits.unassignCalls, contains('l1'));
        expect(bloc.state.assignmentFor('l1'), isNull);
        // Only the one assign call from Sam's tap — no PATCH under "You".
        expect(splits.assignCalls, [('l1', 1.0)]);
        await bloc.close();
      });

      test('tapping a line already owned by a different participant reassigns at fraction 1',
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
        expect(bloc.state.assignmentFor('l1')?.participantName, 'Zoe');
        expect(bloc.state.assignmentFor('l1')?.fraction, 1);
        await bloc.close();
      });

      test('a line-tap failure surfaces a notice', () async {
        final splits = _FakeSplits(assignLineError: true);
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

    group('mutations refetch assignments+summary rather than recompute', () {
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
      test('unassigns every line they held and reassigns active back to You', () async {
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
        expect(splits.unassignCalls, contains('l1'));
        await bloc.close();
      });

      test('reverts the local participant list on failure', () async {
        final splits = _FakeSplits(unassignLineError: true);
        final bloc = _build(splits: splits);
        bloc.add(const SplitBillStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantAdded('Sam'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillLineTapped('l1'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const SplitBillParticipantRemoved('Sam'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(bloc.state.participants, contains('Sam'));
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
