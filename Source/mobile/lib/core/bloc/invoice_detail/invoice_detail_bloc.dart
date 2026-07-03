import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/share_presenter.dart';

part 'invoice_detail_event.dart';
part 'invoice_detail_state.dart';

/// Owns the read-only Invoice Detail screen (18b): loads one invoice, and
/// exposes delete/share/feedback actions. No Split-bill action here — see
/// `specs/mvp/18-mobile-navigation-and-lists/18b-history-invoice-detail.md`
/// for why that affordance is out of scope. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class InvoiceDetailBloc extends Bloc<InvoiceDetailEvent, InvoiceDetailState> {
  InvoiceDetailBloc({
    required IInvoiceRepository invoices,
    required ISharePresenter share,
    required this.invoiceId,
  })  : _invoices = invoices,
        _share = share,
        super(const InvoiceDetailState()) {
    on<InvoiceDetailStarted>(_onStarted);
    on<InvoiceDetailDeleteRequested>(_onDelete);
    on<InvoiceDetailShareRequested>(_onShare);
    on<InvoiceDetailFeedbackSubmitted>(_onFeedback);
  }

  final IInvoiceRepository _invoices;
  final ISharePresenter _share;
  final String invoiceId;

  Future<void> _onStarted(
    InvoiceDetailStarted event,
    Emitter<InvoiceDetailState> emit,
  ) async {
    emit(state.copyWith(status: InvoiceDetailStatus.loading));
    try {
      final detail = await _invoices.getDetail(invoiceId);
      emit(
        state.copyWith(
          status: InvoiceDetailStatus.ready,
          detail: detail,
          feedbackVerdict: _parseVerdict(detail.feedbackVerdict),
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: InvoiceDetailStatus.failure));
    }
  }

  static FeedbackVerdict? _parseVerdict(String? raw) => switch (raw) {
        'UP' => FeedbackVerdict.up,
        'DOWN' => FeedbackVerdict.down,
        _ => null,
      };

  Future<void> _onDelete(
    InvoiceDetailDeleteRequested event,
    Emitter<InvoiceDetailState> emit,
  ) async {
    // Clear any previous notice before retrying — otherwise two consecutive
    // identical-text failures produce an unchanged state and the screen's
    // listener never fires for the second one.
    emit(state.copyWith(isDeleting: true, notice: null));
    try {
      await _invoices.delete(invoiceId);
      emit(state.copyWith(isDeleting: false, deleted: true));
    } catch (_) {
      emit(
        state.copyWith(
          isDeleting: false,
          notice: 'Couldn’t delete this receipt — please try again.',
        ),
      );
    }
  }

  // The native share sheet is invoked here, not the widget — device/OS
  // capabilities go through a Port (`ISharePresenter`), never called
  // directly from UI code.
  Future<void> _onShare(
    InvoiceDetailShareRequested event,
    Emitter<InvoiceDetailState> emit,
  ) async {
    emit(state.copyWith(notice: null));
    try {
      final link = await _invoices.createShare(invoiceId);
      await _share.share(link.url);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t create a share link — please try again.',),);
    }
  }

  Future<void> _onFeedback(
    InvoiceDetailFeedbackSubmitted event,
    Emitter<InvoiceDetailState> emit,
  ) async {
    final previous = state.feedbackVerdict;
    emit(state.copyWith(feedbackVerdict: event.verdict, notice: null));
    try {
      await _invoices.recordFeedback(invoiceId, event.verdict);
    } catch (_) {
      // A newer rating for the same invoice (rapid re-tap) supersedes this
      // one — don't roll its optimistic value back or report this stale
      // failure (mirrors DashboardBloc._onFeedback's same guard).
      if (state.feedbackVerdict != event.verdict) return;
      emit(
        state.copyWith(
          feedbackVerdict: previous,
          notice: 'Couldn’t save your feedback — please try again.',
        ),
      );
    }
  }
}
