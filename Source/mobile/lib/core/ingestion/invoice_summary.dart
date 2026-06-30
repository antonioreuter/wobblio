import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/invoice_status.dart';

/// A row in the recent-invoices list (`GET /invoices`). Only the fields the
/// dashboard renders are kept; the detail/review screen (16e) fetches the rest.
class InvoiceSummary extends Equatable {
  const InvoiceSummary({
    required this.id,
    required this.merchant,
    required this.dateIso,
    required this.total,
    required this.currency,
    required this.status,
    required this.tags,
  });

  final String id;
  final String merchant;

  /// `transactionDate` when present, else the upload day (`createdAt[:10]`),
  /// matching the webapp `mapInvoice` fallback.
  final String dateIso;
  final double total;
  final String currency;

  /// Raw backend status (e.g. `PROCESSING`); map for display via [statusView].
  final String status;
  final List<String> tags;

  InvoiceStatusView get statusView => statusViewFor(status);
  bool get isProcessing => !isTerminalStatus(status);

  @override
  List<Object?> get props =>
      [id, merchant, dateIso, total, currency, status, tags];
}
