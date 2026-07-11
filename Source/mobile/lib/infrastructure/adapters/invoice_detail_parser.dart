import 'package:wobblio/core/ingestion/invoice_detail.dart';

/// Shared `GET /invoices/{id}` response parser — used by both
/// `HttpInvoiceRepository` and `HttpReviewRepository`, which independently
/// call the same endpoint for two different capabilities (post-confirm
/// read/lifecycle vs. pre-confirm correction; see
/// `IInvoiceRepository`'s doc comment). Two ports, one wire-parser: keeping
/// this in one place is what actually prevents the two adapters' field
/// coverage from drifting apart.
InvoiceDetail parseInvoiceDetail(Map<String, dynamic> data) {
  final rawLines = (data['lines'] as List?) ?? const [];
  return InvoiceDetail(
    id: data['id'] as String,
    merchant: (data['merchantName'] as String?) ?? 'Unknown merchant',
    status: data['status'] as String,
    transactionDate: data['transactionDate'] as String?,
    total: (data['total'] as num?)?.toDouble(),
    currency: (data['currency'] as String?) ?? 'EUR',
    totalHomeCurrency: (data['totalHomeCurrency'] as num?)?.toDouble(),
    fxRateUsed: (data['fxRateUsed'] as num?)?.toDouble(),
    homeCurrency: data['homeCurrency'] as String?,
    imageUrl: data['imageUrl'] as String?,
    locationLabel: data['locationLabel'] as String?,
    feedbackVerdict: data['feedbackVerdict'] as String?,
    processingStage: data['processingStage'] as String?,
    lines: rawLines
        .whereType<Map<String, dynamic>>()
        .map(parseInvoiceLine)
        .toList(),
  );
}

InvoiceLineDetail parseInvoiceLine(Map<String, dynamic> l) => InvoiceLineDetail(
      id: l['id'] as String,
      rawText: (l['rawText'] as String?) ?? '',
      productId: l['productId'] as String?,
      quantity: (l['quantity'] as num?)?.toDouble() ?? 1,
      unitPrice: (l['unitPrice'] as num?)?.toDouble(),
      lineTotal: (l['lineTotal'] as num?)?.toDouble() ?? 0,
      categoryName: l['categoryName'] as String?,
      confidence: (l['confidence'] as num?)?.toDouble() ?? 1,
      isDiscount: (l['isDiscount'] as bool?) ?? false,
      isDepositOrFee: (l['isDepositOrFee'] as bool?) ?? false,
    );
