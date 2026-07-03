import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/history/history_bloc.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
InvoiceSummary _inv(
  String id, {
  String merchant = 'Albert Heijn',
  String dateIso = '2026-06-30',
  double total = 12.5,
  List<String> tags = const [],
}) =>
    InvoiceSummary(
      id: id,
      merchant: merchant,
      dateIso: dateIso,
      total: total,
      currency: 'EUR',
      status: 'PARSED',
      tags: tags,
    );

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeInvoices implements IInvoiceRepository {
  _FakeInvoices({List<InvoiceSummary>? invoices, this.listError = false})
      : _invoices = invoices ?? const [];
  final List<InvoiceSummary> _invoices;
  final bool listError;

  @override
  Future<List<InvoiceSummary>> list() async {
    if (listError) throw Exception('boom');
    return _invoices;
  }

  @override
  Future<void> recordFeedback(String invoiceId, FeedbackVerdict verdict) => throw UnimplementedError();

  @override
  Future<InvoiceDetail> getDetail(String invoiceId) => throw UnimplementedError();

  @override
  Future<void> delete(String invoiceId) => throw UnimplementedError();

  @override
  Future<ShareLink> createShare(String invoiceId) => throw UnimplementedError();
}

DateTime _fixedNow() => DateTime(2026, 6, 30);

void main() {
  group('HistoryBloc', () {
    blocTest<HistoryBloc, HistoryState>(
      'started loads the full invoice list',
      build: () => HistoryBloc(
        invoices: _FakeInvoices(invoices: [_inv('a'), _inv('b')]),
        now: _fixedNow,
      ),
      act: (bloc) => bloc.add(const HistoryStarted()),
      expect: () => [
        isA<HistoryState>().having((s) => s.status, 'status', HistoryStatus.loading),
        isA<HistoryState>()
            .having((s) => s.status, 'status', HistoryStatus.ready)
            .having((s) => s.invoices.length, 'invoices', 2),
      ],
    );

    blocTest<HistoryBloc, HistoryState>(
      'load failure surfaces a failure status',
      build: () => HistoryBloc(invoices: _FakeInvoices(listError: true), now: _fixedNow),
      act: (bloc) => bloc.add(const HistoryStarted()),
      skip: 1,
      expect: () => [isA<HistoryState>().having((s) => s.status, 'status', HistoryStatus.failure)],
    );

    blocTest<HistoryBloc, HistoryState>(
      'search filters by merchant name and tag, case-insensitively',
      build: () => HistoryBloc(
        invoices: _FakeInvoices(
          invoices: [
            _inv('a', merchant: 'Jumbo Oostpoort'),
            _inv('b', merchant: 'AH To Go', tags: const ['coffee']),
          ],
        ),
        now: _fixedNow,
      ),
      act: (bloc) async {
        bloc.add(const HistoryStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const HistorySearchChanged('coffee'));
      },
      skip: 2,
      expect: () => [
        isA<HistoryState>().having((s) => s.visibleInvoices.map((i) => i.id), 'visible', ['b']),
      ],
    );

    blocTest<HistoryBloc, HistoryState>(
      'groups invoices by month, most-recent month first',
      build: () => HistoryBloc(
        invoices: _FakeInvoices(
          invoices: [
            _inv('a', dateIso: '2026-06-12'),
            _inv('b', dateIso: '2026-05-30'),
            _inv('c', dateIso: '2026-06-01'),
          ],
        ),
        now: _fixedNow,
      ),
      act: (bloc) => bloc.add(const HistoryStarted()),
      skip: 1,
      verify: (bloc) {
        final groups = bloc.state.monthGroups;
        expect(groups.map((g) => g.label), ['June', 'May']);
        expect(groups.first.invoices.map((i) => i.id), containsAll(['a', 'c']));
      },
    );

    blocTest<HistoryBloc, HistoryState>(
      'this-month total sums only invoices dated in the current month',
      build: () => HistoryBloc(
        invoices: _FakeInvoices(
          invoices: [
            _inv('a', dateIso: '2026-06-12', total: 10),
            _inv('b', dateIso: '2026-06-01', total: 5),
            _inv('c', dateIso: '2026-05-30', total: 100),
          ],
        ),
        now: _fixedNow,
      ),
      act: (bloc) => bloc.add(const HistoryStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.totalThisMonth, 15);
        expect(bloc.state.scannedCount, 3);
      },
    );
  });
}
