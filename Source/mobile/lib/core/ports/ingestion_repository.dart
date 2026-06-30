import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/presign_ticket.dart';

/// Port: the backend ingestion endpoints behind the authed API client.
///
/// [presign] calls `POST /invoices/presign` and maps the status codes to an
/// [UploadException] (409 duplicate, 429 quota, 403 premiumRequired, else
/// failed). [confirm] calls `POST /invoices/{invoiceId}/confirm` to enqueue
/// processing. Concrete adapter (over [IApiClient]) lives in
/// `infrastructure/adapters/`.
abstract class IIngestionRepository {
  Future<PresignTicket> presign(PreparedUpload upload);

  Future<void> confirm(String invoiceId);
}
