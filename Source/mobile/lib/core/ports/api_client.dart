import 'dart:typed_data';

/// A successful API response: HTTP status plus the decoded JSON body
/// (typically `Map<String, dynamic>` or `List<dynamic>`).
class ApiResponse {
  const ApiResponse({required this.statusCode, required this.data});

  final int statusCode;
  final Object? data;
}

/// A single file part for a multipart upload, described without leaking the
/// HTTP SDK into the core. Used by the capture/upload slice (16c).
class MultipartFilePart {
  const MultipartFilePart({
    required this.field,
    required this.filename,
    required this.bytes,
    this.contentType,
  });

  final String field;
  final String filename;
  final Uint8List bytes;

  /// e.g. `image/jpeg`. Null lets the adapter infer a default.
  final String? contentType;
}

/// Port: typed HTTP access to the Wobblio backend.
///
/// Implementations live in `infrastructure/adapters/` and attach the bearer
/// token from [IAuthTokenProvider]. The core depends on this interface only —
/// never on `dio` or any other concrete client. Adapters map transport
/// failures to [ApiException] (`core/error/api_exception.dart`).
abstract class IApiClient {
  Future<ApiResponse> get(String path, {Map<String, dynamic>? query});

  Future<ApiResponse> post(String path, {Object? body});

  Future<ApiResponse> put(String path, {Object? body});

  Future<ApiResponse> delete(String path, {Object? body});

  Future<ApiResponse> postMultipart(
    String path, {
    required List<MultipartFilePart> files,
    Map<String, String>? fields,
  });
}
