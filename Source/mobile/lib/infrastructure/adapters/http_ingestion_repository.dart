import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/presign_ticket.dart';
import 'package:wobblio/core/ingestion/upload_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/ingestion_repository.dart';

/// [IIngestionRepository] over the authed [IApiClient]. Translates the presign
/// status codes into a typed [UploadException] (mirrors the webapp's
/// `uploadReceipt` 409/429/403 handling) so the bloc stays transport-agnostic.
class HttpIngestionRepository implements IIngestionRepository {
  HttpIngestionRepository(this._api);

  final IApiClient _api;

  @override
  Future<PresignTicket> presign(PreparedUpload upload) async {
    final ApiResponse response;
    try {
      response = await _api.post(
        '/invoices/presign',
        body: {'imageSha256': upload.sha256, 'contentType': upload.contentType},
      );
    } on ApiException catch (error) {
      throw _mapPresignError(error);
    }
    return _parseTicket(response.data);
  }

  @override
  Future<void> confirm(String invoiceId) async {
    try {
      await _api.post('/invoices/$invoiceId/confirm');
    } on ApiException catch (error) {
      throw UploadException(UploadErrorCode.failed, error.message);
    }
  }

  UploadException _mapPresignError(ApiException error) {
    switch (error.statusCode) {
      case 409:
        return const UploadException(
          UploadErrorCode.duplicate,
          'This receipt was already scanned.',
        );
      case 429:
        return const UploadException(
          UploadErrorCode.quota,
          'You’ve reached your weekly usage credit limit.',
        );
      case 403:
        return const UploadException(
          UploadErrorCode.premiumRequired,
          'PDF uploads require a Premium plan.',
        );
      default:
        return UploadException(UploadErrorCode.failed, error.message);
    }
  }

  PresignTicket _parseTicket(Object? data) {
    if (data is! Map) {
      throw const UploadException(
          UploadErrorCode.failed, 'Malformed presign response.',);
    }
    final invoiceId = data['invoiceId'];
    final url = data['url'];
    final fields = data['fields'];
    if (invoiceId is! String || url is! String || fields is! Map) {
      throw const UploadException(
          UploadErrorCode.failed, 'Malformed presign response.',);
    }
    return PresignTicket(
      invoiceId: invoiceId,
      url: url,
      fields: fields.map((key, value) => MapEntry('$key', '$value')),
    );
  }
}
