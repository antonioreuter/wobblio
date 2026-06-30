import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/presign_ticket.dart';

/// Port: upload the prepared bytes to S3 via the presigned multipart POST.
///
/// The [PreparedUpload] bytes are always produced by [IUploadPreparer], so an
/// image is already EXIF/GPS-stripped + compressed before it reaches here — no
/// raw camera bytes (with metadata) are ever uploaded (GDPR, spec 16c).
/// Submits the signed [PresignTicket.fields] plus the file part last, to
/// [PresignTicket.url] — a different host that must receive **no** bearer token
/// (so the adapter uses its own client, not the authed [IApiClient]). Maps any
/// non-success to a [UploadException] (`failed`). Concrete adapter (`dio`) lives
/// in `infrastructure/adapters/`.
abstract class IS3Uploader {
  Future<void> upload(PresignTicket ticket, PreparedUpload upload);
}
