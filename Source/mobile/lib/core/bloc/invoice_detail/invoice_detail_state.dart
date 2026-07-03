part of 'invoice_detail_bloc.dart';

enum InvoiceDetailStatus { loading, ready, failure }

/// Single immutable invoice-detail state. [deleted] is a one-shot signal the
/// screen awaits to pop and tell History to refresh (mirrors how
/// `ReviewScreen` already returns a value to `DashboardScreen`). Sharing has
/// no state of its own — the bloc invokes the native share sheet directly via
/// [ISharePresenter] once a link is created, rather than round-tripping a URL
/// through state for the widget to act on.
class InvoiceDetailState extends Equatable {
  const InvoiceDetailState({
    this.status = InvoiceDetailStatus.loading,
    this.detail,
    this.feedbackVerdict,
    this.isDeleting = false,
    this.deleted = false,
    this.notice,
  });

  final InvoiceDetailStatus status;
  final InvoiceDetail? detail;
  final FeedbackVerdict? feedbackVerdict;
  final bool isDeleting;
  final bool deleted;
  final String? notice;

  InvoiceDetailState copyWith({
    InvoiceDetailStatus? status,
    InvoiceDetail? detail,
    bool? isDeleting,
    bool? deleted,
    // feedbackVerdict/notice are nullable-with-clear, so use explicit sentinels.
    Object? feedbackVerdict = _unset,
    Object? notice = _unset,
  }) {
    return InvoiceDetailState(
      status: status ?? this.status,
      detail: detail ?? this.detail,
      feedbackVerdict: feedbackVerdict == _unset
          ? this.feedbackVerdict
          : feedbackVerdict as FeedbackVerdict?,
      isDeleting: isDeleting ?? this.isDeleting,
      deleted: deleted ?? this.deleted,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props =>
      [status, detail, feedbackVerdict, isDeleting, deleted, notice];
}

const Object _unset = Object();
