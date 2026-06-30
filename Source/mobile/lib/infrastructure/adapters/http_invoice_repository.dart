import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';

/// [IInvoiceRepository] over the authed [IApiClient]. Maps the `GET /invoices`
/// rows to [InvoiceSummary] (mirrors the webapp `mapInvoice` field fallbacks).
class HttpInvoiceRepository implements IInvoiceRepository {
  HttpInvoiceRepository(this._api);

  final IApiClient _api;

  @override
  Future<List<InvoiceSummary>> list() async {
    final response = await _api.get('/invoices');
    final data = response.data;
    if (data is! Map || data['invoices'] is! List) {
      throw const ApiException('Malformed /invoices response', statusCode: 502);
    }
    return (data['invoices'] as List)
        .whereType<Map<String, dynamic>>()
        .map(_toSummary)
        .toList();
  }

  @override
  Future<void> recordFeedback(String invoiceId, FeedbackVerdict verdict) async {
    await _api
        .post('/invoices/$invoiceId/feedback', body: {'verdict': verdict.wire});
  }

  InvoiceSummary _toSummary(Map<String, dynamic> row) {
    final created = (row['createdAt'] as String?) ?? '';
    final tags = (row['searchTagLabels'] as List?) ??
        (row['searchTags'] as List?) ??
        const [];
    return InvoiceSummary(
      id: row['id'] as String,
      merchant: (row['merchantName'] as String?) ?? 'Unknown merchant',
      dateIso: (row['transactionDate'] as String?) ??
          (created.length >= 10 ? created.substring(0, 10) : created),
      total: (row['total'] as num?)?.toDouble() ?? 0,
      currency: (row['currency'] as String?) ?? 'EUR',
      status: row['status'] as String,
      tags: tags.map((t) => '$t').toList(),
    );
  }
}
