import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/infrastructure/adapters/invoice_detail_parser.dart';

/// [IInvoiceRepository] over the authed [IApiClient]. Maps the `GET /invoices`
/// rows to [InvoiceSummary] (mirrors the webapp `mapInvoice` field fallbacks).
/// [getDetail]'s response shape is shared with `HttpReviewRepository` via
/// `parseInvoiceDetail` (`invoice_detail_parser.dart`) — the two ports stay
/// separate (different capability, ISP), but the wire parser doesn't.
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

  @override
  Future<InvoiceDetail> getDetail(String invoiceId) async {
    final response = await _api.get('/invoices/$invoiceId');
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed invoice detail response',
          statusCode: 502,);
    }
    return parseInvoiceDetail(data);
  }

  @override
  Future<void> delete(String invoiceId) async {
    await _api.delete('/invoices/$invoiceId');
  }

  @override
  Future<ShareLink> createShare(String invoiceId) async {
    final response = await _api.post('/invoices/$invoiceId/share');
    final data = response.data;
    if (data is! Map<String, dynamic> || data['url'] is! String) {
      throw const ApiException('Malformed invoice share response',
          statusCode: 502,);
    }
    return ShareLink(
      url: data['url'] as String,
      expiresAt: (data['expiresAt'] as String?) ?? '',
    );
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
