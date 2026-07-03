import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/invoice_correction.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/review_repository.dart';
import 'package:wobblio/infrastructure/adapters/invoice_detail_parser.dart';

/// [IReviewRepository] over the authed [IApiClient]. [getDetail]'s response
/// shape is shared with `HttpInvoiceRepository` via `parseInvoiceDetail`
/// (`invoice_detail_parser.dart`).
class HttpReviewRepository implements IReviewRepository {
  HttpReviewRepository(this._api);

  final IApiClient _api;

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
  Future<void> correct(String invoiceId, InvoiceCorrection correction) async {
    await _api.put('/invoices/$invoiceId', body: correction.toJson());
  }

  @override
  Future<void> discard(String invoiceId) async {
    await _api.delete('/invoices/$invoiceId');
  }
}
