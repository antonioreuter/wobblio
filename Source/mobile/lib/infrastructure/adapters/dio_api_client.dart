import 'package:dio/dio.dart';

import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/auth_token_provider.dart';

/// dio-backed [IApiClient].
///
/// An interceptor attaches the bearer token from the injected
/// [IAuthTokenProvider] on every request, and all `DioException`s are mapped to
/// [ApiException] so the domain never sees the HTTP SDK's error types.
class DioApiClient implements IApiClient {
  DioApiClient({
    required String baseUrl,
    required IAuthTokenProvider tokenProvider,
    Dio? dio,
  }) : _dio = (dio ?? Dio())
          ..options.baseUrl = baseUrl
          ..options.connectTimeout = const Duration(seconds: 10)
          ..options.receiveTimeout = const Duration(seconds: 30) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenProvider.bearerToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;

  @override
  Future<ApiResponse> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _dio.get<Object?>(path, queryParameters: query));

  @override
  Future<ApiResponse> post(String path, {Object? body}) =>
      _send(() => _dio.post<Object?>(path, data: body));

  @override
  Future<ApiResponse> put(String path, {Object? body}) =>
      _send(() => _dio.put<Object?>(path, data: body));

  @override
  Future<ApiResponse> patch(String path, {Object? body}) =>
      _send(() => _dio.patch<Object?>(path, data: body));

  @override
  Future<ApiResponse> delete(String path, {Object? body}) =>
      _send(() => _dio.delete<Object?>(path, data: body));

  @override
  Future<ApiResponse> postMultipart(
    String path, {
    required List<MultipartFilePart> files,
    Map<String, String>? fields,
  }) {
    final form = FormData();
    if (fields != null) {
      form.fields.addAll(fields.entries);
    }
    for (final file in files) {
      form.files.add(
        MapEntry(
          file.field,
          MultipartFile.fromBytes(
            file.bytes,
            filename: file.filename,
            contentType: file.contentType == null
                ? null
                : DioMediaType.parse(file.contentType!),
          ),
        ),
      );
    }
    return _send(() => _dio.post<Object?>(path, data: form));
  }

  Future<ApiResponse> _send(
    Future<Response<Object?>> Function() request,
  ) async {
    try {
      final response = await request();
      return ApiResponse(
        statusCode: response.statusCode ?? 0,
        data: response.data,
      );
    } on DioException catch (error) {
      throw _mapError(error);
    }
  }

  ApiException _mapError(DioException error) {
    final isNetwork = error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.connectionError;
    return ApiException(
      error.message ?? 'Request failed',
      statusCode: error.response?.statusCode,
      isNetworkError: isNetwork,
    );
  }
}
