import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/dashboard/dashboard_bloc.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ingestion/usage_summary.dart';
import 'package:wobblio/core/ports/insights_repository.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/usage_repository.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
InvoiceSummary _inv(
  String id, {
  String status = 'PARSED',
  List<String> tags = const [],
}) =>
    InvoiceSummary(
      id: id,
      merchant: 'Albert Heijn',
      dateIso: '2026-06-30',
      total: 12.5,
      currency: 'EUR',
      status: status,
      tags: tags,
    );

const _usage = UsageSummary(used: 1, cap: 3, remaining: 2, unlimited: false);

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeInvoices implements IInvoiceRepository {
  _FakeInvoices({
    List<List<InvoiceSummary>>? pages,
    this.listError = false,
    this.feedbackError = false,
    this.slowFailVerdict,
  }) : _pages = pages ?? [];
  final List<List<InvoiceSummary>> _pages;
  final bool listError;
  final bool feedbackError;
  // Verdict whose recordFeedback resolves slowly and then fails — lets a test
  // land a second (fast, succeeding) rating before this one's failure resolves.
  final FeedbackVerdict? slowFailVerdict;
  int listCalls = 0;
  final List<(String, FeedbackVerdict)> recorded = [];

  @override
  Future<List<InvoiceSummary>> list() async {
    if (listError) throw Exception('boom');
    final page = _pages.isEmpty
        ? <InvoiceSummary>[]
        : _pages[listCalls < _pages.length ? listCalls : _pages.length - 1];
    listCalls++;
    return page;
  }

  @override
  Future<void> recordFeedback(String invoiceId, FeedbackVerdict verdict) async {
    recorded.add((invoiceId, verdict));
    if (verdict == slowFailVerdict) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      throw Exception('boom');
    }
    if (feedbackError) throw Exception('boom');
  }

  // Not exercised by DashboardBloc tests (18b territory) — unimplemented stubs
  // are enough to satisfy the interface here.
  @override
  Future<InvoiceDetail> getDetail(String invoiceId) => throw UnimplementedError();

  @override
  Future<void> delete(String invoiceId) => throw UnimplementedError();

  @override
  Future<ShareLink> createShare(String invoiceId) => throw UnimplementedError();
}

class _FakeUsage implements IUsageRepository {
  _FakeUsage({this.fail = false}) : usage = _usage;
  final UsageSummary usage;
  final bool fail;
  @override
  Future<UsageSummary> fetch() async {
    if (fail) throw Exception('boom');
    return usage;
  }
}

class _FakeInsights implements IInsightsRepository {
  _FakeInsights({this.fail = false});
  final bool fail;
  @override
  Future<InflationInsight> fetchInflation() async {
    if (fail) throw Exception('boom');
    return const InflationInsight(personalInflationPct: 1.2, basketSize: 5);
  }
}

// Zero-delay schedule so polling tests run instantly.
const _fastSchedule = [Duration.zero, Duration.zero, Duration.zero];

DashboardBloc _build({
  _FakeInvoices? invoices,
  _FakeUsage? usage,
  _FakeInsights? insights,
  List<Duration> pollSchedule = _fastSchedule,
  int maxPollAttempts = 40,
}) =>
    DashboardBloc(
      invoices: invoices ??
          _FakeInvoices(
            pages: [
              [_inv('a')],
            ],
          ),
      usage: usage ?? _FakeUsage(),
      insights: insights ?? _FakeInsights(),
      pollSchedule: pollSchedule,
      maxPollAttempts: maxPollAttempts,
    );

void main() {
  group('DashboardBloc', () {
    test('initial state is loading and empty', () {
      final bloc = _build();
      expect(bloc.state.status, DashboardStatus.loading);
      expect(bloc.state.invoices, isEmpty);
    });

    blocTest<DashboardBloc, DashboardState>(
      'started loads invoices + usage → ready',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a'), _inv('b')],
          ],
        ),
        usage: _FakeUsage(),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 10),
      verify: (bloc) {
        expect(bloc.state.status, DashboardStatus.ready);
        expect(bloc.state.invoices.length, 2);
        expect(bloc.state.usage, _usage);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'load failure → failure status with notice',
      build: () => _build(invoices: _FakeInvoices(listError: true)),
      act: (bloc) => bloc.add(const DashboardStarted()),
      verify: (bloc) {
        expect(bloc.state.status, DashboardStatus.failure);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'started loads the inflation insight into state',
      build: () => _build(),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 10),
      verify: (bloc) {
        expect(bloc.state.inflation?.personalInflationPct, 1.2);
        expect(bloc.state.inflation?.basketSize, 5);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'inflation-insight failure does not fail the load (card stays null)',
      build: () => _build(insights: _FakeInsights(fail: true)),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 10),
      verify: (bloc) {
        expect(bloc.state.status, DashboardStatus.ready);
        expect(bloc.state.inflation, isNull);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'usage failure does not fail the load',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a')],
          ],
        ),
        usage: _FakeUsage(fail: true),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 10),
      verify: (bloc) {
        expect(bloc.state.status, DashboardStatus.ready);
        expect(bloc.state.usage, isNull);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'polls a processing row until it reaches a terminal status, then stops',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING')], // initial load
            [_inv('a', status: 'PROCESSING')], // tick 1: still processing
            [_inv('a', status: 'PARSED')], // tick 2: terminal → stop
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        expect(bloc.state.invoices.single.status, 'PARSED');
        expect(bloc.state.invoices.single.isProcessing, isFalse);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'sets a one-shot ready notice when a receipt finishes mid-poll',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING')], // initial load
            [_inv('a', status: 'PARSED')], // tick 1: finished
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        expect(bloc.state.notice, 'Receipt ready — tap it to review.');
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'bumps noticeSeq for each receipt that finishes, even with identical text',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING'), _inv('b', status: 'PROCESSING')],
            [_inv('a', status: 'PARSED'), _inv('b', status: 'PROCESSING')],
            [_inv('a', status: 'PARSED'), _inv('b', status: 'PARSED')],
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        // Both receipts produced 'Receipt ready — …'; the token advanced twice so
        // the UI's listenWhen re-fires the snackbar for the second one.
        expect(bloc.state.notice, 'Receipt ready — tap it to review.');
        expect(bloc.state.noticeSeq, 2);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'notices a failed parse when a receipt fails mid-poll',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING')],
            [_inv('a', status: 'FAILED_PROCESSING')],
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        expect(bloc.state.notice, contains('couldn’t read'));
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'a still-processing tick leaves the notice untouched',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING')], // initial
            [_inv('a', status: 'PROCESSING')], // tick 1: no transition
            [_inv('a', status: 'PARSED')], // tick 2: terminal → stop
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        // Only the terminal tick set a notice; the plain tick set none.
        expect(bloc.state.notice, 'Receipt ready — tap it to review.');
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'does not poll when nothing is processing',
      build: () {
        final invoices = _FakeInvoices(
          pages: [
            [_inv('a', status: 'PARSED')],
          ],
        );
        return _build(invoices: invoices);
      },
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 30),
      verify: (bloc) {
        // Only the initial load fetched — no poll ticks.
        expect(bloc.state.status, DashboardStatus.ready);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'keeps polling past the backoff ramp until terminal',
      build: () => _build(
        // One-entry ramp; ticks beyond it reuse the last interval.
        pollSchedule: const [Duration.zero],
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING')], // initial
            [_inv('a', status: 'PROCESSING')], // tick 1 (ramp)
            [_inv('a', status: 'PROCESSING')], // tick 2 (past ramp)
            [_inv('a', status: 'PROCESSING')], // tick 3 (past ramp)
            [_inv('a', status: 'PARSED')], // tick 4: terminal → stop
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) => expect(bloc.state.invoices.single.status, 'PARSED'),
    );

    blocTest<DashboardBloc, DashboardState>(
      'gives up after maxPollAttempts when a row never becomes terminal',
      build: () => _build(
        pollSchedule: const [Duration.zero],
        maxPollAttempts: 3,
        invoices: _FakeInvoices(
          pages: [
            [_inv('a', status: 'PROCESSING')], // always processing (reused)
          ],
        ),
      ),
      act: (bloc) => bloc.add(const DashboardStarted()),
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        // Stops (no hang); the row is still processing after the cap.
        expect(bloc.state.invoices.single.isProcessing, isTrue);
      },
    );

    test('a superseded feedback failure does not roll back the newer rating', () async {
      final bloc = _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a')],
          ],
          slowFailVerdict: FeedbackVerdict.up, // first (up) resolves slowly, fails
        ),
      );
      bloc.add(const DashboardStarted());
      await Future<void>.delayed(const Duration(milliseconds: 10));
      // Rapid re-tap: up (slow-fail) then down (fast-success).
      bloc.add(const DashboardFeedbackSubmitted('a', FeedbackVerdict.up));
      await Future<void>.delayed(Duration.zero);
      bloc.add(const DashboardFeedbackSubmitted('a', FeedbackVerdict.down));
      // Wait past the slow up-failure (20ms).
      await Future<void>.delayed(const Duration(milliseconds: 40));
      expect(bloc.state.feedback['a'], FeedbackVerdict.down);
      expect(bloc.state.notice, isNull);
      await bloc.close();
    });

    blocTest<DashboardBloc, DashboardState>(
      'tag selection filters visible invoices; reselect clears',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [
              _inv('a', tags: ['groceries']),
              _inv('b', tags: ['fuel']),
            ],
          ],
        ),
      ),
      act: (bloc) async {
        bloc.add(const DashboardStarted());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const DashboardTagSelected('groceries'));
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.visibleInvoices.map((i) => i.id), ['a']);
        bloc.add(const DashboardTagSelected('groceries')); // toggle off
      },
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.selectedTag, isNull);
        expect(bloc.state.visibleInvoices.length, 2);
        expect(bloc.state.availableTags, ['fuel', 'groceries']);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'feedback is optimistic and persists on success',
      build: () {
        final invoices = _FakeInvoices(
          pages: [
            [_inv('a')],
          ],
        );
        return _build(invoices: invoices);
      },
      act: (bloc) async {
        bloc.add(const DashboardStarted());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const DashboardFeedbackSubmitted('a', FeedbackVerdict.up));
      },
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.feedback['a'], FeedbackVerdict.up);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'feedback reverts and notices on failure',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a')],
          ],
          feedbackError: true,
        ),
      ),
      act: (bloc) async {
        bloc.add(const DashboardStarted());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const DashboardFeedbackSubmitted('a', FeedbackVerdict.down));
      },
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.feedback.containsKey('a'), isFalse);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'refresh refetches invoices and usage',
      build: () => _build(
        invoices: _FakeInvoices(
          pages: [
            [_inv('a')], // initial
            [_inv('a'), _inv('b')], // after refresh
          ],
        ),
      ),
      act: (bloc) async {
        bloc.add(const DashboardStarted());
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const DashboardRefreshed());
      },
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.invoices.length, 2);
        expect(bloc.state.isRefreshing, isFalse);
      },
    );
  });
}
