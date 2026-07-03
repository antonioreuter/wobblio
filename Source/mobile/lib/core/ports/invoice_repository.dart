import 'package:wobblio/core/ingestion/feedback_verdict.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';

/// Port: the tenant's invoice list, accuracy feedback, and post-confirm
/// read/lifecycle operations (18b — History + Invoice Detail).
///
/// [list] calls `GET /invoices` (newest first, DISCARDED excluded server-side,
/// no pagination — see `specs/mvp/18-mobile-navigation-and-lists/18-00-handoff.md`).
/// [recordFeedback] calls `POST /invoices/{id}/feedback` `{ verdict }`.
/// [getDetail]/[delete]/[createShare] call the same `GET`/`DELETE`/`POST
/// /invoices/{id}(/share)` endpoints [IReviewRepository] already uses for the
/// pre-confirm correction flow — deliberately a separate port method set here
/// (post-confirm read/lifecycle is a different capability from correction,
/// even though today's backend serves both from the same URL; see 18b's
/// resolved-conflict note for why this isn't reused as one port). The two
/// adapters share one wire-parser (`parseInvoiceDetail` in
/// `infrastructure/adapters/invoice_detail_parser.dart`) so this port split
/// can't drift the response-field coverage the way duplicated parsing did.
/// Concrete adapter (over [IApiClient]) lives in `infrastructure/adapters/`;
/// transport failures surface as [ApiException].
abstract class IInvoiceRepository {
  Future<List<InvoiceSummary>> list();

  Future<void> recordFeedback(String invoiceId, FeedbackVerdict verdict);

  Future<InvoiceDetail> getDetail(String invoiceId);

  Future<void> delete(String invoiceId);

  Future<ShareLink> createShare(String invoiceId);
}
