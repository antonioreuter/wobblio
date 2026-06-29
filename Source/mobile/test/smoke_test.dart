import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/app.dart';
import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

class _EmptyStore implements ISecureTokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<AuthTokens?> read() async => null;
  @override
  Future<void> write(AuthTokens tokens) async {}
}

class _UnusedAuthenticator implements ICognitoAuthenticator {
  @override
  Future<AuthTokens> authenticate() => throw UnimplementedError();
  @override
  Future<void> endSession(String idToken) async {}
  @override
  Future<AuthTokens> refresh(String refreshToken) => throw UnimplementedError();
}

class _UnusedProfiles implements IProfileRepository {
  @override
  Future<UserProfile> fetchProfile() => throw UnimplementedError();
}

void main() {
  testWidgets('app boots to the sign-in screen when no session is persisted',
      (tester) async {
    final expired = StreamController<void>.broadcast();
    addTearDown(expired.close);
    final bloc = AuthBloc(
      authenticator: _UnusedAuthenticator(),
      tokenStore: _EmptyStore(),
      profileRepository: _UnusedProfiles(),
      onSessionExpired: expired.stream,
    )..add(const AuthBootstrapRequested());
    addTearDown(bloc.close);

    await tester.pumpWidget(WobblioApp(authBloc: bloc));
    // Flush the async bootstrap (store read -> AuthSignedOut), then rebuild.
    await tester.pump();
    await tester.pump();

    // Lands on the sign-in screen, themed.
    expect(find.byKey(const Key('login-screen')), findsOneWidget);
    expect(find.text('Wobblio'), findsOneWidget);

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
    expect(app.theme?.scaffoldBackgroundColor, const Color(0xFF161A24));
  });
}
