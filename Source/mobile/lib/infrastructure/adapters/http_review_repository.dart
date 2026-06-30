import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/invoice_correction.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/review_repository.dart';

/// [IReviewRepository] over the authed [IApiClient].
class HttpReviewRepository implements IReviewRepository {
  HttpReviewRepository(this._api);

  final IApiClient _api;

  @override
  Future<InvoiceDetail> getDetail(String invoiceId) async {
    final response = await _api.get('/invoices/$invoiceId');
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed invoice detail response', statusCode: 502);
    }
    return _toDetail(data);
  }

  @override
  Future<void> correct(String invoiceId, InvoiceCorrection correction) async {
    await _api.put('/invoices/$invoiceId', body: correction.toJson());
  }

  @override
  Future<void> discard(String invoiceId) async {
    await _api.delete('/invoices/$invoiceId');
  }

  InvoiceDetail _toDetail(Map<String, dynamic> data) {
    final rawLines = (data['lines'] as List?) ?? const [];
    return InvoiceDetail(
      id: data['id'] as String,
      merchant: (data['merchantName'] as String?) ?? 'Unknown merchant',
      status: data['status'] as String,
      transactionDate: data['transactionDate'] as String?,
      total: (data['total'] as num?)?.toDouble(),
      currency: (data['currency'] as String?) ?? 'EUR',
      imageUrl: data['imageUrl'] as String?,
      lines: rawLines
          .whereType<Map<String, dynamic>>()
          .map(_toLine)
          .toList(),
    );
  }

  InvoiceLineDetail _toLine(Map<String, dynamic> l) => InvoiceLineDetail(
        id: l['id'] as String,
        rawText: (l['rawText'] as String?) ?? '',
        productId: l['productId'] as String?,
        quantity: (l['quantity'] as num?)?.toDouble() ?? 1,
        unitPrice: (l['unitPrice'] as num?)?.toDouble(),
        lineTotal: (l['lineTotal'] as num?)?.toDouble() ?? 0,
        categoryName: l['categoryName'] as String?,
        confidence: (l['confidence'] as num?)?.toDouble() ?? 1,
      );
}
