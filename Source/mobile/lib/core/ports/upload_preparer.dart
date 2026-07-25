import 'dart:typed_data';

import 'package:wobblio/core/ingestion/prepared_upload.dart';

/// Port: turn raw picked bytes into a [PreparedUpload] ready for presign + S3.
///
/// Fills the spec's "IImageProcessor (EXIF strip + compress + SHA-256)" role and
/// additionally covers the PDF branch — one cohesive "prepare for upload"
/// responsibility, mirroring the webapp's `prepareUpload`.
///
/// [prepareImage] MUST strip EXIF/GPS and compress to a ≤1MB JPEG client-side
/// (GDPR — no geotags leave the device), then hash the final bytes. It also runs
/// the capture-quality gate (fix 11 · sub-spec 05): a blurry/glary/dark photo
/// throws `UploadException(UploadErrorCode.lowQuality, …)` UNLESS [force] is set
/// (the user chose "upload anyway"). Fail-open — an undecodable image skips the gate.
/// [preparePdf] keeps the document bytes as-is (no EXIF, rasterizing would lose
/// the native text) and hashes them. Concrete adapter
/// (`flutter_image_compress` + `crypto`) lives in `infrastructure/adapters/`.
abstract class IUploadPreparer {
  Future<PreparedUpload> prepareImage(Uint8List raw, {bool force = false});

  Future<PreparedUpload> preparePdf(Uint8List raw);
}
