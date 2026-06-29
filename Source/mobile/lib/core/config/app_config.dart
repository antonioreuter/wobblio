/// Static, build-time application configuration.
///
/// Stage-specific values are injected at build time via `--dart-define`,
/// mirroring the webapp's `API_BASE_URL` env handling (see
/// `Source/webapp/src/lib/server/api-proxy.ts`) so dev/prod share one code path.
/// No secrets live here — the mobile Cognito client is public (PKCE, no secret),
/// only its public client ID + the public backend base URL.
class AppConfig {
  const AppConfig._();

  /// Backend API base URL, e.g. `https://api.dev.wobblio.app`.
  /// Supply per stage: `--dart-define=API_BASE_URL=https://...`.
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// True when a base URL was supplied at build time.
  static bool get hasApiBaseUrl => apiBaseUrl.isNotEmpty;

  /// Cognito **mobile** user-pool client ID (public client). Exported per stage
  /// by `WobblioAuthStack` (`mobile-client-id`); supply via
  /// `--dart-define=COGNITO_CLIENT_ID=...`.
  static const String cognitoClientId =
      String.fromEnvironment('COGNITO_CLIENT_ID');

  /// Cognito Hosted-UI host (no scheme), e.g.
  /// `wobblio-dev.auth.eu-west-1.amazoncognito.com`. Exported per stage by
  /// `WobblioAuthStack` (`cognito-domain`); supply via
  /// `--dart-define=COGNITO_DOMAIN=...`.
  static const String cognitoDomain = String.fromEnvironment('COGNITO_DOMAIN');

  /// Deep-link the Hosted UI returns to after sign-in. Must match the mobile
  /// client's allow-listed callback URL (`WobblioAuthStack.ts`).
  static const String cognitoRedirectUri = 'wobblio://auth/callback';

  /// Deep-link the Hosted UI returns to after sign-out.
  static const String cognitoLogoutUri = 'wobblio://auth/logout';

  /// OAuth scopes requested at sign-in (match the mobile client config).
  static const List<String> cognitoScopes = ['openid', 'email', 'profile'];

  /// True when both Cognito values were supplied at build time.
  static bool get hasCognitoConfig =>
      cognitoClientId.isNotEmpty && cognitoDomain.isNotEmpty;
}
