import 'package:dio/dio.dart';

import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/presign_ticket.dart';
import 'package:wobblio/core/ingestion/upload_exception.dart';
import 'package:wobblio/core/ports/s3_uploader.dart';

/// [IS3Uploader] over `dio`, posting the presigned multipart form to S3.
///
/// The uploaded image bytes are already EXIF/GPS-stripped + compressed upstream
/// by [IUploadPreparer] (this adapter never re-encodes), so no metadata leaves
/// the device. Uses its **own** `Dio` (no auth interceptor) — the presigned URL
/// is a different host that must not receive the backend bearer token. The
/// signed fields go first, the file part last (S3 requirement). Any non-success
/// maps to an [UploadException] (`failed`).
class DioS3Uploader implements IS3Uploader {
  DioS3Uploader([Dio? dio]) : _dio = dio ?? Dio();

  final Dio _dio;

  @override
  Future<void> upload(PresignTicket ticket, PreparedUpload upload) async {
    final form = FormData();
    form.fields.addAll(ticket.fields.entries);
    form.files.add(
      MapEntry(
        'file',
        MultipartFile.fromBytes(
          upload.bytes,
          filename: upload.filename,
          contentType: DioMediaType.parse(upload.contentType),
        ),
      ),
    );

    try {
      await _dio.post<void>(ticket.url, data: form);
    } on DioException catch (error) {
      throw UploadException(
        UploadErrorCode.failed,
        error.message ?? 'Uploading the file failed.',
      );
    }
  }
}
