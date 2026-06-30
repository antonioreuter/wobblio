import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';

/// Port: the tenant's invoice list + accuracy feedback.
///
/// [list] calls `GET /invoices` (newest first, DISCARDED excluded server-side).
/// [recordFeedback] calls `POST /invoices/{id}/feedback` `{ verdict }`. Concrete
/// adapter (over [IApiClient]) lives in `infrastructure/adapters/`; transport
/// failures surface as [ApiException].
abstract class IInvoiceRepository {
  Future<List<InvoiceSummary>> list();

  Future<void> recordFeedback(String invoiceId, FeedbackVerdict verdict);
}
