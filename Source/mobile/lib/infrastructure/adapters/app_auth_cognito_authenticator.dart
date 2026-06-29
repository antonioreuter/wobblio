import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_appauth/flutter_appauth.dart';

import 'package:wobblio/core/auth/auth_exception.dart';
import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/config/app_config.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';

/// [ICognitoAuthenticator] backed by `flutter_appauth` (AppAuth). It runs the
/// Cognito Hosted-UI auth-code + PKCE flow in an `ASWebAuthenticationSession`
/// (iOS) / Chrome Custom Tab (Android), returning via `wobblio://auth/callback`,
/// and exchanges/refreshes tokens at the Hosted-UI `/oauth2/token` endpoint.
///
/// The mobile client is public (no secret), so only `client_id` is sent — PKCE
/// is the protection. Endpoints are built explicitly from the Hosted-UI domain
/// (no OIDC discovery round-trip needed).
class AppAuthCognitoAuthenticator implements ICognitoAuthenticator {
  AppAuthCognitoAuthenticator({FlutterAppAuth? appAuth})
      : _appAuth = appAuth ?? const FlutterAppAuth();

  final FlutterAppAuth _appAuth;

  AuthorizationServiceConfiguration get _config =>
      const AuthorizationServiceConfiguration(
        authorizationEndpoint: 'https://${AppConfig.cognitoDomain}/oauth2/authorize',
        tokenEndpoint: 'https://${AppConfig.cognitoDomain}/oauth2/token',
        endSessionEndpoint: 'https://${AppConfig.cognitoDomain}/logout',
      );

  @override
  Future<AuthTokens> authenticate() async {
    try {
      final result = await _appAuth.authorizeAndExchangeCode(
        AuthorizationTokenRequest(
          AppConfig.cognitoClientId,
          AppConfig.cognitoRedirectUri,
          serviceConfiguration: _config,
          scopes: AppConfig.cognitoScopes,
        ),
      );
      return _toTokens(
        idToken: result.idToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.accessTokenExpirationDateTime,
      );
    } on PlatformException catch (error) {
      throw _isUserCancelled(error)
          ? const AuthCancelledException()
          : AuthFailedException(error.message ?? 'Sign-in failed');
    } catch (_) {
      throw const AuthFailedException();
    }
  }

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    try {
      final result = await _appAuth.token(
        TokenRequest(
          AppConfig.cognitoClientId,
          AppConfig.cognitoRedirectUri,
          serviceConfiguration: _config,
          refreshToken: refreshToken,
          grantType: GrantType.refreshToken,
          scopes: AppConfig.cognitoScopes,
        ),
      );
      return _toTokens(
        idToken: result.idToken,
        accessToken: result.accessToken,
        // Cognito does not rotate the refresh token on this grant.
        refreshToken: result.refreshToken ?? refreshToken,
        expiresAt: result.accessTokenExpirationDateTime,
      );
    } catch (_) {
      throw const SessionExpiredException();
    }
  }

  @override
  Future<void> endSession(String idToken) async {
    try {
      await _appAuth.endSession(
        EndSessionRequest(
          idTokenHint: idToken,
          postLogoutRedirectUrl: AppConfig.cognitoLogoutUri,
          serviceConfiguration: _config,
        ),
      );
    } on PlatformException catch (error) {
      if (_isUserCancelled(error)) return; // closing the sheet is fine
      throw AuthFailedException(error.message ?? 'Sign-out failed');
    } catch (_) {
      throw const AuthFailedException();
    }
  }

  AuthTokens _toTokens({
    required String? idToken,
    required String? accessToken,
    required String? refreshToken,
    required DateTime? expiresAt,
  }) {
    if (idToken == null || accessToken == null || refreshToken == null) {
      throw const AuthFailedException('Token response was incomplete');
    }
    return AuthTokens(
      idToken: idToken,
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiresAt:
          expiresAt ?? DateTime.now().add(const Duration(hours: 1)),
    );
  }

  bool _isUserCancelled(PlatformException error) {
    final haystack = '${error.code} ${error.message}'.toLowerCase();
    return haystack.contains('cancel');
  }
}
