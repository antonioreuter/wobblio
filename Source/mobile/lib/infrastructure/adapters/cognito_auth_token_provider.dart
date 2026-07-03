import 'dart:async';

import 'package:wobblio/core/auth/auth_exception.dart';
import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/ports/auth_token_provider.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

/// Real [IAuthTokenProvider] (replaces the 16a stub). Supplies the **ID token**
/// for `Authorization: Bearer`, refreshing it silently before expiry so the
/// `DioApiClient` interceptor — which calls [bearerToken] per request — gets a
/// valid token without any change to the HTTP adapter.
///
/// When the refresh token can no longer be exchanged, the persisted session is
/// cleared and [onSessionExpired] fires; the [AuthBloc] listens and forces
/// re-login (mirrors the webapp's `RefreshAccessTokenError` → `ForceSignOut`).
class CognitoAuthTokenProvider implements IAuthTokenProvider {
  CognitoAuthTokenProvider({
    required ISecureTokenStore tokenStore,
    required ICognitoAuthenticator authenticator,
  })  : _store = tokenStore,
        _authenticator = authenticator;

  final ISecureTokenStore _store;
  final ICognitoAuthenticator _authenticator;
  final StreamController<void> _sessionExpired =
      StreamController<void>.broadcast();

  /// Emits once each time silent refresh fails irrecoverably.
  Stream<void> get onSessionExpired => _sessionExpired.stream;

  Future<AuthTokens>? _inFlightRefresh;

  @override
  Future<String?> bearerToken() async {
    final tokens = await _store.read();
    if (tokens == null) return null;
    if (!tokens.isExpired()) return tokens.idToken;

    try {
      final refreshed = await _refreshOnce(tokens.refreshToken);
      return refreshed.idToken;
    } on SessionExpiredException {
      await _store.clear();
      if (!_sessionExpired.isClosed) _sessionExpired.add(null);
      return null;
    }
  }

  /// Dedupes concurrent refreshes: parallel in-flight requests share one grant.
  Future<AuthTokens> _refreshOnce(String refreshToken) {
    return _inFlightRefresh ??=
        _authenticator.refresh(refreshToken).then((tokens) async {
      await _store.write(tokens);
      return tokens;
    }).whenComplete(() => _inFlightRefresh = null);
  }

  Future<void> dispose() => _sessionExpired.close();
}
