import 'package:wobblio/core/auth/auth_tokens.dart';

/// Port: the Cognito Hosted-UI auth-code (PKCE) handshake and token lifecycle.
///
/// The adapter (flutter_appauth) opens the system auth session, handles the
/// `wobblio://auth/callback` redirect, and exchanges the code for tokens — none
/// of which the domain needs to know about. Throws [AuthException] subtypes
/// (`core/auth/auth_exception.dart`) on cancellation / failure.
abstract class ICognitoAuthenticator {
  /// Launches Hosted-UI sign-in and returns the freshly issued token bundle.
  Future<AuthTokens> authenticate();

  /// Exchanges a refresh token for a new bundle. Throws
  /// [SessionExpiredException] when the refresh token is no longer valid.
  Future<AuthTokens> refresh(String refreshToken);

  /// Ends the Cognito session (clears the Hosted-UI SSO cookie) for [idToken].
  Future<void> endSession(String idToken);
}
