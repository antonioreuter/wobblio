/// Why a capture/upload failed, mapped from the backend presign status codes
/// (mirrors the webapp's `UploadErrorCode`):
/// - [duplicate] — 409, this receipt (same SHA-256) was already scanned.
/// - [quota] — 429, the weekly usage-credit limit is reached.
/// - [premiumRequired] — 403, PDF uploads need a Premium plan.
/// - [failed] — anything else (bad request, S3 PUT failure, network, …).
enum UploadErrorCode { duplicate, quota, premiumRequired, failed }

/// Domain error thrown by [IIngestionRepository]/[IS3Uploader] so the
/// [CaptureBloc] never sees HTTP status codes or SDK error types.
class UploadException implements Exception {
  const UploadException(this.code, this.message);

  final UploadErrorCode code;
  final String message;

  @override
  String toString() => 'UploadException($code): $message';
}
