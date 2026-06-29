/// Port: supplies the bearer token for authenticated API calls.
///
/// The API client depends on this abstraction only — it never reads secure
/// storage or talks to Cognito directly. 16b supplies the real adapter;
/// 16a ships a stub returning null (unauthenticated).
abstract class IAuthTokenProvider {
  /// The current bearer token, or null when the user is not authenticated.
  Future<String?> bearerToken();
}
