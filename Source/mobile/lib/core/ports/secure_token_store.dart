import 'package:wobblio/core/auth/auth_tokens.dart';

/// Port: persistence for the Cognito token bundle, backed by the platform
/// keystore (iOS Keychain / Android Keystore) in the adapter layer. The domain
/// never touches the native secure store directly.
abstract class ISecureTokenStore {
  /// The stored bundle, or null when no session is persisted.
  Future<AuthTokens?> read();

  Future<void> write(AuthTokens tokens);

  Future<void> clear();
}
