part of 'review_bloc.dart';

sealed class ReviewEvent extends Equatable {
  const ReviewEvent();

  @override
  List<Object?> get props => [];
}

/// Load the invoice detail for [invoiceId] into the editable form.
class ReviewStarted extends ReviewEvent {
  const ReviewStarted(this.invoiceId);

  final String invoiceId;

  @override
  List<Object?> get props => [invoiceId];
}

/// Edit the receipt date (ISO yyyy-MM-dd, or null to clear).
class ReviewDateEdited extends ReviewEvent {
  const ReviewDateEdited(this.dateIso);

  final String? dateIso;

  @override
  List<Object?> get props => [dateIso];
}

/// Edit the receipt total (null to leave blank).
class ReviewTotalEdited extends ReviewEvent {
  const ReviewTotalEdited(this.total);

  final double? total;

  @override
  List<Object?> get props => [total];
}

/// Replace one line with its edited values (matched by id).
class ReviewLineEdited extends ReviewEvent {
  const ReviewLineEdited(this.line);

  final InvoiceLineDetail line;

  @override
  List<Object?> get props => [line];
}

/// Product autocomplete for the line bottom sheet.
class ReviewProductSearched extends ReviewEvent {
  const ReviewProductSearched(this.query);

  final String query;

  @override
  List<Object?> get props => [query];
}

/// Save corrections → flip the invoice to PARSED.
class ReviewConfirmed extends ReviewEvent {
  const ReviewConfirmed();
}

/// Discard the invoice (used for SUSPECTED_DUPLICATE).
class ReviewDiscarded extends ReviewEvent {
  const ReviewDiscarded();
}
