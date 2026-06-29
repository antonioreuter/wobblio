/// Domain-level API error.
///
/// Adapters map transport/SDK failures (e.g. `DioException`, socket errors,
/// non-2xx responses) into this type so the core never sees infrastructure
/// error classes — mirroring the backend's "throw only domain errors from the
/// core" rule.
class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.statusCode,
    this.isNetworkError = false,
  });

  final String message;

  /// HTTP status when the failure carried one; null for transport errors.
  final int? statusCode;

  /// True when the request never received a response (timeout, no
  /// connectivity).
  final bool isNetworkError;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => 'ApiException(${statusCode ?? 'network'}): $message';
}
