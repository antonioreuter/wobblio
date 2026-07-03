import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/upload_exception.dart';
import 'package:wobblio/core/ports/upload_preparer.dart';

/// [IUploadPreparer] using `flutter_image_compress` (EXIF strip + JPEG re-encode)
/// and `crypto` (SHA-256). Mirrors the webapp's `prepareUpload`
/// (`Source/webapp/src/lib/upload-receipt.ts`).
class ImageCompressUploadPreparer implements IUploadPreparer {
  const ImageCompressUploadPreparer();

  // Mirror the webapp constants.
  static const int _maxBytes = 1000000;
  static const int _maxDimension = 1600;
  static const int _minQuality = 40;
  static const int _maxPdfBytes =
      4500000; // mirrors backend /quotas/max_pdf_bytes

  @override
  Future<PreparedUpload> prepareImage(Uint8List raw) async {
    // Re-encoding to JPEG drops all EXIF/GPS (keepExif defaults to false; set it
    // explicitly so the GDPR guarantee survives a library default change).
    var quality = 90;
    var bytes = await _compress(raw, quality);
    while (bytes.length > _maxBytes && quality > _minQuality) {
      quality -= 10;
      bytes = await _compress(raw, quality);
    }
    return PreparedUpload(
      bytes: bytes,
      sha256: _digest(bytes),
      contentType: 'image/jpeg',
    );
  }

  @override
  Future<PreparedUpload> preparePdf(Uint8List raw) async {
    if (raw.length > _maxPdfBytes) {
      throw const UploadException(
        UploadErrorCode.failed,
        'This PDF is too large (max 4.5 MB).',
      );
    }
    // A PDF is uploaded as-is — no EXIF to strip and rasterizing would lose the
    // native text the backend parses.
    return PreparedUpload(
      bytes: raw,
      sha256: _digest(raw),
      contentType: 'application/pdf',
    );
  }

  Future<Uint8List> _compress(Uint8List raw, int quality) async {
    final out = await FlutterImageCompress.compressWithList(
      raw,
      minWidth: _maxDimension,
      minHeight: _maxDimension,
      quality: quality,
      format: CompressFormat.jpeg,
      keepExif: false,
    );
    if (out.isEmpty) {
      throw const UploadException(
        UploadErrorCode.failed,
        'Image processing failed.',
      );
    }
    return out;
  }

  String _digest(Uint8List bytes) => sha256.convert(bytes).toString();
}
