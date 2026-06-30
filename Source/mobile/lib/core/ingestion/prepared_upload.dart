import 'dart:typed_data';

/// Picked receipt bytes turned into something ready for presign + S3 upload.
///
/// Mirrors the webapp's `PreparedImage`/`prepareUpload` (see
/// `Source/webapp/src/lib/upload-receipt.ts`): for images [bytes] are the
/// re-encoded, EXIF-stripped, ≤1MB JPEG; for PDFs they are the original file
/// bytes. [sha256] is the lowercase hex digest of [bytes] (the dedup key), and
/// [contentType] is `image/jpeg` or `application/pdf`.
class PreparedUpload {
  const PreparedUpload({
    required this.bytes,
    required this.sha256,
    required this.contentType,
  });

  final Uint8List bytes;
  final String sha256;
  final String contentType;

  bool get isPdf => contentType == 'application/pdf';

  /// Filename the S3 multipart POST attaches to the `file` part — S3 requires a
  /// filename to treat the part as an object upload.
  String get filename => isPdf ? 'receipt.pdf' : 'receipt.jpg';
}
