part of 'invoice_detail_bloc.dart';

sealed class InvoiceDetailEvent extends Equatable {
  const InvoiceDetailEvent();

  @override
  List<Object?> get props => [];
}

/// First load: fetch the invoice detail.
class InvoiceDetailStarted extends InvoiceDetailEvent {
  const InvoiceDetailStarted();
}

/// "Delete invoice" tapped.
class InvoiceDetailDeleteRequested extends InvoiceDetailEvent {
  const InvoiceDetailDeleteRequested();
}

/// "Share" tapped.
class InvoiceDetailShareRequested extends InvoiceDetailEvent {
  const InvoiceDetailShareRequested();
}

/// Optimistically rate this invoice's accuracy, then persist; revert on failure.
class InvoiceDetailFeedbackSubmitted extends InvoiceDetailEvent {
  const InvoiceDetailFeedbackSubmitted(this.verdict);

  final FeedbackVerdict verdict;

  @override
  List<Object?> get props => [verdict];
}
