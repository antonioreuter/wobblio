import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/invoice_detail/invoice_detail_bloc.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/share_presenter.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
InvoiceDetail _detailFixture({String? feedbackVerdict}) => InvoiceDetail(
      id: 'inv-1',
      merchant: 'AH To Go',
      status: 'PARSED',
      transactionDate: '2026-06-30',
      total: 7.58,
      currency: 'EUR',
      imageUrl: 'https://s3/photo.jpg',
      locationLabel: 'North Brabant, Netherlands',
      feedbackVerdict: feedbackVerdict,
      lines: const [],
    );

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeInvoices implements IInvoiceRepository {
  _FakeInvoices({
    InvoiceDetail? detail,
    this.loadError = false,
    this.deleteError = false,
    this.shareError = false,
    this.feedbackError = false,
    this.slowFailVerdict,
  }) : _detail = detail ?? _detailFixture();

  final InvoiceDetail _detail;
  final bool loadError;
  final bool deleteError;
  final bool shareError;
  final bool feedbackError;
  // Verdict whose recordFeedback resolves slowly and then fails — lets a test
  // land a second (fast, succeeding) rating before this one's failure resolves.
  final FeedbackVerdict? slowFailVerdict;
  bool deleted = false;
  final List<(String, FeedbackVerdict)> recorded = [];

  @override
  Future<InvoiceDetail> getDetail(String invoiceId) async {
    if (loadError) throw Exception('boom');
    return _detail;
  }

  @override
  Future<void> delete(String invoiceId) async {
    if (deleteError) throw Exception('boom');
    deleted = true;
  }

  @override
  Future<ShareLink> createShare(String invoiceId) async {
    if (shareError) throw Exception('boom');
    return const ShareLink(url: 'https://wobblio.app/shared-lists/tok', expiresAt: '2026-07-07');
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

  @override
  Future<List<InvoiceSummary>> list() => throw UnimplementedError();
}

class _FakeShare implements ISharePresenter {
  final List<String> shared = [];
  final List<String> copied = [];

  @override
  Future<void> share(String text) async {
    shared.add(text);
  }

  @override
  Future<void> copyToClipboard(String text) async {
    copied.add(text);
  }
}

InvoiceDetailBloc _build({_FakeInvoices? invoices, _FakeShare? share}) => InvoiceDetailBloc(
      invoices: invoices ?? _FakeInvoices(),
      share: share ?? _FakeShare(),
      invoiceId: 'inv-1',
    );

void main() {
  group('InvoiceDetailBloc', () {
    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'started loads the detail',
      build: _build,
      act: (bloc) => bloc.add(const InvoiceDetailStarted()),
      expect: () => [
        isA<InvoiceDetailState>().having((s) => s.status, 'status', InvoiceDetailStatus.loading),
        isA<InvoiceDetailState>()
            .having((s) => s.status, 'status', InvoiceDetailStatus.ready)
            .having((s) => s.detail?.id, 'detail', 'inv-1'),
      ],
    );

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'started parses an existing feedback verdict from the backend',
      build: () => _build(invoices: _FakeInvoices(detail: _detailFixture(feedbackVerdict: 'DOWN'))),
      act: (bloc) => bloc.add(const InvoiceDetailStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.feedbackVerdict, FeedbackVerdict.down),
    );

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'load failure surfaces a failure status',
      build: () => _build(invoices: _FakeInvoices(loadError: true)),
      act: (bloc) => bloc.add(const InvoiceDetailStarted()),
      skip: 1,
      expect: () => [
        isA<InvoiceDetailState>().having((s) => s.status, 'status', InvoiceDetailStatus.failure),
      ],
    );

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'delete succeeds → deleted signal set',
      build: _build,
      act: (bloc) async {
        bloc.add(const InvoiceDetailStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const InvoiceDetailDeleteRequested());
      },
      skip: 2,
      expect: () => [
        isA<InvoiceDetailState>().having((s) => s.isDeleting, 'isDeleting', true),
        isA<InvoiceDetailState>().having((s) => s.deleted, 'deleted', true),
      ],
    );

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'delete failure surfaces a notice, does not set deleted',
      build: () => _build(invoices: _FakeInvoices(deleteError: true)),
      act: (bloc) async {
        bloc.add(const InvoiceDetailStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const InvoiceDetailDeleteRequested());
      },
      skip: 2,
      verify: (bloc) {
        expect(bloc.state.deleted, isFalse);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'delete failure twice in a row still notices both times (notice reset before retry)',
      build: () => _build(invoices: _FakeInvoices(deleteError: true)),
      act: (bloc) async {
        bloc.add(const InvoiceDetailStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const InvoiceDetailDeleteRequested());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const InvoiceDetailDeleteRequested());
      },
      skip: 4,
      // The second attempt's isDeleting:true,notice:null emit + its failure
      // emit — both distinguishable states, proving notice was cleared first.
      expect: () => [
        isA<InvoiceDetailState>().having((s) => s.isDeleting, 'isDeleting', true).having((s) => s.notice, 'notice', isNull),
        isA<InvoiceDetailState>().having((s) => s.notice, 'notice', isNotNull),
      ],
    );

    test('share succeeds calls ISharePresenter with the created link', () async {
      final share = _FakeShare();
      final bloc = _build(share: share);
      bloc.add(const InvoiceDetailStarted());
      await Future<void>.delayed(Duration.zero);
      bloc.add(const InvoiceDetailShareRequested());
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(share.shared, ['https://wobblio.app/shared-lists/tok']);
      await bloc.close();
    });

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'share failure surfaces a notice',
      build: () => _build(invoices: _FakeInvoices(shareError: true)),
      act: (bloc) async {
        bloc.add(const InvoiceDetailStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const InvoiceDetailShareRequested());
      },
      skip: 2,
      verify: (bloc) => expect(bloc.state.notice, isNotNull),
    );

    blocTest<InvoiceDetailBloc, InvoiceDetailState>(
      'feedback is optimistic and reverts on failure',
      build: () => _build(invoices: _FakeInvoices(feedbackError: true)),
      act: (bloc) async {
        bloc.add(const InvoiceDetailStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const InvoiceDetailFeedbackSubmitted(FeedbackVerdict.down));
      },
      wait: const Duration(milliseconds: 10),
      verify: (bloc) {
        expect(bloc.state.feedbackVerdict, isNull);
        expect(bloc.state.notice, isNotNull);
      },
    );

    test('a superseded feedback failure does not roll back the newer rating', () async {
      final bloc = _build(
        invoices: _FakeInvoices(slowFailVerdict: FeedbackVerdict.up),
      );
      bloc.add(const InvoiceDetailStarted());
      await Future<void>.delayed(Duration.zero);
      // Rapid re-tap: up (slow-fail) then down (fast-success).
      bloc.add(const InvoiceDetailFeedbackSubmitted(FeedbackVerdict.up));
      await Future<void>.delayed(Duration.zero);
      bloc.add(const InvoiceDetailFeedbackSubmitted(FeedbackVerdict.down));
      // Wait past the slow up-failure (20ms).
      await Future<void>.delayed(const Duration(milliseconds: 40));
      expect(bloc.state.feedbackVerdict, FeedbackVerdict.down);
      await bloc.close();
    });
  });
}
