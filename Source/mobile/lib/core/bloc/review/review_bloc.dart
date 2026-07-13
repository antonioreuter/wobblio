import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/invoice_correction.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/product_match.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';
import 'package:wobblio/core/ports/review_repository.dart';

part 'review_event.dart';
part 'review_state.dart';

/// Drives the on-device review & correction screen (16e): load the parsed invoice,
/// edit date/total/line items, search products for a line, then Confirm (→ PARSED)
/// or Discard. Depends on ports only; widgets stay logic-free.
class ReviewBloc extends Bloc<ReviewEvent, ReviewState> {
  ReviewBloc({
    required IReviewRepository review,
    required IProductSearchRepository products,
  })  : _review = review,
        _products = products,
        super(const ReviewState()) {
    on<ReviewStarted>(_onStarted);
    on<ReviewDateEdited>(
        (e, emit) => emit(state.copyWith(transactionDate: e.dateIso)),);
    on<ReviewTotalEdited>((e, emit) => emit(state.copyWith(total: e.total)));
    on<ReviewLineEdited>(_onLineEdited);
    on<ReviewProductSearched>(_onProductSearched);
    on<ReviewConfirmed>(_onConfirmed);
    on<ReviewDiscarded>(_onDiscarded);
  }

  final IReviewRepository _review;
  final IProductSearchRepository _products;

  // Bumped per search so a slower earlier response can't overwrite newer results.
  int _searchGen = 0;

  Future<void> _onStarted(
      ReviewStarted event, Emitter<ReviewState> emit,) async {
    emit(state.copyWith(status: ReviewStatus.loading));
    try {
      final detail = await _review.getDetail(event.invoiceId);
      emit(
        state.copyWith(
          status: ReviewStatus.ready,
          invoiceId: detail.id,
          merchant: detail.merchant,
          currency: detail.currency,
          imageUrl: detail.imageUrl,
          rawStatus: detail.status,
          transactionDate: detail.transactionDate,
          total: detail.total,
          lines: detail.lines,
        ),
      );
    } catch (_) {
      emit(state.copyWith(
          status: ReviewStatus.failure, notice: 'Couldn’t load this receipt.',),);
    }
  }

  void _onLineEdited(ReviewLineEdited event, Emitter<ReviewState> emit) {
    final lines = [
      for (final line in state.lines)
        line.id == event.line.id ? event.line : line,
    ];
    emit(state.copyWith(
        lines: lines, dirtyLineIds: {...state.dirtyLineIds, event.line.id},),);
  }

  Future<void> _onProductSearched(
      ReviewProductSearched event, Emitter<ReviewState> emit,) async {
    final query = event.query.trim();
    final gen = ++_searchGen;
    if (query.length < 2) {
      emit(state.copyWith(searchResults: const [], searching: false));
      return;
    }
    emit(state.copyWith(searching: true));
    try {
      final results = await _products.search(query);
      // A newer keystroke superseded this search — drop the stale response.
      if (gen != _searchGen) return;
      emit(state.copyWith(searchResults: results, searching: false));
    } catch (_) {
      if (gen != _searchGen) return;
      emit(state.copyWith(searchResults: const [], searching: false));
    }
  }

  Future<void> _onConfirmed(
      ReviewConfirmed event, Emitter<ReviewState> emit,) async {
    emit(state.copyWith(status: ReviewStatus.submitting, notice: null));
    try {
      await _review.correct(state.invoiceId, _correction());
      emit(state.copyWith(status: ReviewStatus.success));
    } catch (_) {
      emit(state.copyWith(
          status: ReviewStatus.ready,
          notice: 'Couldn’t save — please try again.',),);
    }
  }

  Future<void> _onDiscarded(
      ReviewDiscarded event, Emitter<ReviewState> emit,) async {
    emit(state.copyWith(status: ReviewStatus.submitting, notice: null));
    try {
      await _review.discard(state.invoiceId);
      emit(state.copyWith(status: ReviewStatus.discarded));
    } catch (_) {
      emit(state.copyWith(
          status: ReviewStatus.ready,
          notice: 'Couldn’t discard — please try again.',),);
    }
  }

  InvoiceCorrection _correction() => InvoiceCorrection(
        transactionDate: state.transactionDate,
        total: state.total,
        // Only the edited lines — untouched lines keep their parsed values + amber.
        lines: [
          for (final line in state.lines)
            if (state.dirtyLineIds.contains(line.id))
              CorrectionLine(
                id: line.id,
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
                // "Set size" (09/05): send the user-annotated size so the backend stamps it USER.
                sizePackQuantity:
                    line.sizeSource == 'USER' ? line.packQuantity : null,
                sizeBaseUnit: line.sizeSource == 'USER' ? line.baseUnit : null,
              ),
        ],
      );
}
