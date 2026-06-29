import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

/// [ISecureTokenStore] backed by the platform keystore (iOS Keychain / Android
/// Keystore) via `flutter_secure_storage`. The bundle is JSON-encoded under a
/// single key; `first_unlock_this_device` keeps it readable after reboot but
/// never leaves the device or syncs to iCloud.
class FlutterSecureTokenStore implements ISecureTokenStore {
  FlutterSecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  static const String _key = 'wobblio.auth.tokens';

  final FlutterSecureStorage _storage;

  @override
  Future<AuthTokens?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    return AuthTokens.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  Future<void> write(AuthTokens tokens) =>
      _storage.write(key: _key, value: jsonEncode(tokens.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}
