import 'package:wobblio/core/ingestion/invoice_correction.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';

/// Port: the review screen's invoice operations (16e).
///
/// [getDetail] → `GET /invoices/{id}` (photo url + lines + confidence).
/// [correct] → `PUT /invoices/{id}` (saves edits, flips to PARSED).
/// [discard] → `DELETE /invoices/{id}` (used for SUSPECTED_DUPLICATE).
/// Concrete adapter (over [IApiClient]) lives in `infrastructure/adapters/`.
abstract class IReviewRepository {
  Future<InvoiceDetail> getDetail(String invoiceId);

  Future<void> correct(String invoiceId, InvoiceCorrection correction);

  Future<void> discard(String invoiceId);
}
