/// Domain-level auth errors. Adapters map flutter_appauth / platform failures
/// into these so the core never sees the auth SDK's exception types — mirroring
/// the "throw only domain errors from the core" rule.
sealed class AuthException implements Exception {
  const AuthException(this.message);
  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

/// The user dismissed the Hosted-UI sign-in sheet before completing it.
class AuthCancelledException extends AuthException {
  const AuthCancelledException([super.message = 'Sign-in was cancelled']);
}

/// Sign-in failed for any non-cancellation reason (network, IdP error, …).
class AuthFailedException extends AuthException {
  const AuthFailedException([super.message = 'Sign-in failed']);
}

/// The refresh-token grant failed — the session can no longer be silently
/// renewed (refresh token expired after 30d or revoked). Forces re-login.
class SessionExpiredException extends AuthException {
  const SessionExpiredException([super.message = 'Session expired']);
}
