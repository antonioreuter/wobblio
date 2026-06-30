import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/review/review_bloc.dart';
import 'package:wobblio/core/ingestion/invoice_correction.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/product_match.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';
import 'package:wobblio/core/ports/review_repository.dart';

// ── Fixtures ──────────────────────────────────────────────────────────────────
InvoiceLineDetail _line(String id, {String? productId, double confidence = 1}) =>
    InvoiceLineDetail(
      id: id,
      rawText: 'MELK 1L',
      productId: productId,
      quantity: 1,
      unitPrice: 1.2,
      lineTotal: 1.2,
      categoryName: 'Dairy',
      confidence: confidence,
    );

InvoiceDetail _detailFixture({String status = 'NEEDS_REVIEW'}) => InvoiceDetail(
      id: 'inv-1',
      merchant: 'Albert Heijn',
      status: status,
      transactionDate: '2026-06-30',
      total: 12.5,
      currency: 'EUR',
      imageUrl: 'https://s3/photo.jpg',
      lines: [_line('l1', confidence: 0.4), _line('l2', productId: 'p-existing')],
    );

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeReview implements IReviewRepository {
  _FakeReview({InvoiceDetail? detail, this.loadError = false, this.correctError = false, this.discardError = false})
      : _detail = detail ?? _detailFixture();
  final InvoiceDetail _detail;
  final bool loadError;
  final bool correctError;
  final bool discardError;
  InvoiceCorrection? corrected;
  bool discarded = false;

  @override
  Future<InvoiceDetail> getDetail(String invoiceId) async {
    if (loadError) throw Exception('boom');
    return _detail;
  }

  @override
  Future<void> correct(String invoiceId, InvoiceCorrection correction) async {
    if (correctError) throw Exception('boom');
    corrected = correction;
  }

  @override
  Future<void> discard(String invoiceId) async {
    if (discardError) throw Exception('boom');
    discarded = true;
  }
}

class _FakeProducts implements IProductSearchRepository {
  _FakeProducts({this.results = const [], this.byQuery = false, this.slowFirstMs = 0});
  final List<ProductMatch> results;
  // Return a single match whose id == the query (lets a test tell responses apart).
  final bool byQuery;
  // Delay the first call so a later query can resolve before it (race test).
  final int slowFirstMs;
  int calls = 0;

  @override
  Future<List<ProductMatch>> search(String query) async {
    final n = ++calls;
    if (slowFirstMs > 0 && n == 1) {
      await Future<void>.delayed(Duration(milliseconds: slowFirstMs));
    }
    return byQuery ? [ProductMatch(productId: query, displayName: query, brand: null)] : results;
  }
}

ReviewBloc _build({_FakeReview? review, _FakeProducts? products}) => ReviewBloc(
      review: review ?? _FakeReview(),
      products: products ?? _FakeProducts(),
    );

void main() {
  group('ReviewBloc', () {
    blocTest<ReviewBloc, ReviewState>(
      'started loads the detail into the editable form',
      build: _build,
      act: (bloc) => bloc.add(const ReviewStarted('inv-1')),
      wait: const Duration(milliseconds: 10),
      verify: (bloc) {
        expect(bloc.state.status, ReviewStatus.ready);
        expect(bloc.state.lines.length, 2);
        expect(bloc.state.total, 12.5);
        expect(bloc.state.transactionDate, '2026-06-30');
      },
    );

    blocTest<ReviewBloc, ReviewState>(
      'load failure → failure status',
      build: () => _build(review: _FakeReview(loadError: true)),
      act: (bloc) => bloc.add(const ReviewStarted('inv-1')),
      wait: const Duration(milliseconds: 10),
      verify: (bloc) => expect(bloc.state.status, ReviewStatus.failure),
    );

    blocTest<ReviewBloc, ReviewState>(
      'edits date, total and a line, then confirms with the merged payload',
      build: () => _build(review: _FakeReview()),
      act: (bloc) async {
        bloc.add(const ReviewStarted('inv-1'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const ReviewDateEdited('2026-07-01'));
        bloc.add(const ReviewTotalEdited(9.99));
        bloc.add(ReviewLineEdited(_line('l1', productId: 'p-fixed').copyWith(lineTotal: 2.0)));
        bloc.add(const ReviewConfirmed());
      },
      wait: const Duration(milliseconds: 30),
      verify: (bloc) {
        expect(bloc.state.status, ReviewStatus.success);
        final review = (bloc.state.invoiceId, bloc.state.transactionDate);
        expect(review.$2, '2026-07-01');
      },
    );

    test('confirm posts the corrected fields and lines', () async {
      final review = _FakeReview();
      final bloc = _build(review: review);
      bloc.add(const ReviewStarted('inv-1'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      bloc.add(const ReviewTotalEdited(9.99));
      bloc.add(ReviewLineEdited(_line('l1', productId: 'p-fixed').copyWith(lineTotal: 2.0)));
      bloc.add(const ReviewConfirmed());
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(review.corrected, isNotNull);
      expect(review.corrected!.total, 9.99);
      // Only the edited line (l1) is sent — the untouched l2 is omitted.
      expect(review.corrected!.lines.map((l) => l.id), ['l1']);
      final l1 = review.corrected!.lines.single;
      expect(l1.productId, 'p-fixed');
      expect(l1.lineTotal, 2.0);
      await bloc.close();
    });

    test('a header-only confirm sends no line edits', () async {
      final review = _FakeReview();
      final bloc = _build(review: review);
      bloc.add(const ReviewStarted('inv-1'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      bloc.add(const ReviewTotalEdited(9.99));
      bloc.add(const ReviewConfirmed());
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(review.corrected!.lines, isEmpty);
      expect(review.corrected!.total, 9.99);
      await bloc.close();
    });

    test('a stale (slower) product search response does not overwrite a newer one', () async {
      final products = _FakeProducts(byQuery: true, slowFirstMs: 30);
      final bloc = _build(products: products);
      bloc.add(const ReviewStarted('inv-1'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      bloc.add(const ReviewProductSearched('aa')); // slow → resolves last
      await Future<void>.delayed(Duration.zero);
      bloc.add(const ReviewProductSearched('bb')); // fast → resolves first
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(bloc.state.searchResults.single.productId, 'bb');
      await bloc.close();
    });

    blocTest<ReviewBloc, ReviewState>(
      'confirm failure returns to ready with a notice',
      build: () => _build(review: _FakeReview(correctError: true)),
      act: (bloc) async {
        bloc.add(const ReviewStarted('inv-1'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const ReviewConfirmed());
      },
      wait: const Duration(milliseconds: 30),
      verify: (bloc) {
        expect(bloc.state.status, ReviewStatus.ready);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<ReviewBloc, ReviewState>(
      'discard succeeds → discarded',
      build: () => _build(review: _FakeReview(detail: _detailFixture(status: 'SUSPECTED_DUPLICATE'))),
      act: (bloc) async {
        bloc.add(const ReviewStarted('inv-1'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const ReviewDiscarded());
      },
      wait: const Duration(milliseconds: 30),
      verify: (bloc) => expect(bloc.state.status, ReviewStatus.discarded),
    );

    blocTest<ReviewBloc, ReviewState>(
      'discard failure returns to ready with a notice',
      build: () => _build(
        review: _FakeReview(detail: _detailFixture(status: 'SUSPECTED_DUPLICATE'), discardError: true),
      ),
      act: (bloc) async {
        bloc.add(const ReviewStarted('inv-1'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const ReviewDiscarded());
      },
      wait: const Duration(milliseconds: 30),
      verify: (bloc) {
        expect(bloc.state.status, ReviewStatus.ready);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<ReviewBloc, ReviewState>(
      'short product queries do not hit the backend',
      build: () {
        final products = _FakeProducts(results: const [ProductMatch(productId: 'p', displayName: 'Milk', brand: null)]);
        return _build(products: products);
      },
      act: (bloc) async {
        bloc.add(const ReviewStarted('inv-1'));
        await Future<void>.delayed(const Duration(milliseconds: 10));
        bloc.add(const ReviewProductSearched('a')); // too short
      },
      wait: const Duration(milliseconds: 10),
      verify: (bloc) => expect(bloc.state.searchResults, isEmpty),
    );

    test('product search of 2+ chars returns matches', () async {
      final products = _FakeProducts(results: const [ProductMatch(productId: 'p', displayName: 'Milk', brand: 'AH')]);
      final bloc = _build(products: products);
      bloc.add(const ReviewStarted('inv-1'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      bloc.add(const ReviewProductSearched('milk'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(bloc.state.searchResults.single.productId, 'p');
      expect(products.calls, 1);
      await bloc.close();
    });
  });
}
