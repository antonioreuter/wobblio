import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:crypto/crypto.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import 'package:wobblio/core/domain/image_quality.dart';
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
  // Downscale target for the quality gate (aspect preserved). The Laplacian sharpness measure is
  // resolution-coupled, so this must track the webapp's assessed scale or the shared minSharpness
  // threshold over-flags: the webapp assesses the ≤1600px compression canvas (~900px wide for a
  // portrait receipt), so a 400px sample averaged out edge energy and false-flagged sharp photos
  // as blurry (fix 11 review ⑨). 1000px matches the webapp's effective portrait width.
  static const int _sampleWidth = 1000;

  @override
  Future<PreparedUpload> prepareImage(Uint8List raw, {bool force = false}) async {
    // Capture-quality gate (fix 11 · sub-spec 05): block a blurry/glary/dark photo BEFORE
    // presign/upload so no credit is spent — unless the user chose "upload anyway" (force).
    if (!force) await _assertReadable(raw);
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

  /// Decode a downscaled RGBA sample of [raw] and run the pure quality gate. Fail-open: if the
  /// bytes can't be decoded we skip the gate (never block a real receipt on a decode quirk).
  Future<void> _assertReadable(Uint8List raw) async {
    final source = await _sampleLuminance(raw);
    if (source == null) return;
    final verdict = assessImageQuality(source);
    if (verdict.ok) return;
    throw UploadException(
      UploadErrorCode.lowQuality,
      qualityIssueMessage(verdict.issues),
    );
  }

  Future<LuminanceSource?> _sampleLuminance(Uint8List raw) async {
    try {
      final codec = await ui.instantiateImageCodec(raw, targetWidth: _sampleWidth);
      final frame = await codec.getNextFrame();
      final image = frame.image;
      final byteData = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      final width = image.width;
      final height = image.height;
      image.dispose();
      if (byteData == null) return null;
      return LuminanceSource(
        data: byteData.buffer.asUint8List(),
        width: width,
        height: height,
      );
    } catch (_) {
      return null; // undecodable → skip the gate rather than block
    }
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
