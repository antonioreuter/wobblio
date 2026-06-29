import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/auth_exception.dart';
import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
AuthTokens _tokens() => AuthTokens(
      idToken: 'id',
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
    );

const _onboarded = UserProfile(
  onboarded: true,
  fullName: 'Ada',
  role: 'STANDARD',
  status: 'ACTIVE',
);
const _notOnboarded = UserProfile(
  onboarded: false,
  fullName: '',
  role: 'STANDARD',
  status: 'ACTIVE',
);

// ── Hand-rolled fakes (no mockito — stay lean) ───────────────────────────────
class _FakeTokenStore implements ISecureTokenStore {
  _FakeTokenStore([this._tokens]);
  AuthTokens? _tokens;
  int clearCount = 0;
  AuthTokens? written;

  @override
  Future<AuthTokens?> read() async => _tokens;

  @override
  Future<void> write(AuthTokens tokens) async {
    written = tokens;
    _tokens = tokens;
  }

  @override
  Future<void> clear() async {
    clearCount++;
    _tokens = null;
  }
}

class _FakeAuthenticator implements ICognitoAuthenticator {
  _FakeAuthenticator({this.authenticateImpl});
  Future<AuthTokens> Function()? authenticateImpl;
  int endSessionCount = 0;

  @override
  Future<AuthTokens> authenticate() => authenticateImpl!();

  @override
  Future<AuthTokens> refresh(String refreshToken) async =>
      throw const SessionExpiredException();

  @override
  Future<void> endSession(String idToken) async => endSessionCount++;
}

class _FakeProfiles implements IProfileRepository {
  _FakeProfiles(this.impl);
  Future<UserProfile> Function() impl;

  @override
  Future<UserProfile> fetchProfile() => impl();
}

void main() {
  late StreamController<void> expired;

  setUp(() => expired = StreamController<void>.broadcast());
  tearDown(() => expired.close());

  group('bootstrap', () {
    blocTest<AuthBloc, AuthState>(
      'no persisted session -> signed out',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(),
        tokenStore: _FakeTokenStore(),
        profileRepository: _FakeProfiles(() async => _onboarded),
        onSessionExpired: expired.stream,
      ),
      act: (bloc) => bloc.add(const AuthBootstrapRequested()),
      expect: () => const [AuthSignedOut()],
    );

    blocTest<AuthBloc, AuthState>(
      'persisted session + onboarded -> authed',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(),
        tokenStore: _FakeTokenStore(_tokens()),
        profileRepository: _FakeProfiles(() async => _onboarded),
        onSessionExpired: expired.stream,
      ),
      act: (bloc) => bloc.add(const AuthBootstrapRequested()),
      expect: () => const [AuthAuthed(_onboarded)],
    );

    blocTest<AuthBloc, AuthState>(
      'persisted session + not onboarded -> onboarding required',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(),
        tokenStore: _FakeTokenStore(_tokens()),
        profileRepository: _FakeProfiles(() async => _notOnboarded),
        onSessionExpired: expired.stream,
      ),
      act: (bloc) => bloc.add(const AuthBootstrapRequested()),
      expect: () => const [AuthOnboardingRequired(_notOnboarded)],
    );

    blocTest<AuthBloc, AuthState>(
      'session no longer refreshable -> clears store and signs out',
      build: () {
        final store = _FakeTokenStore(_tokens());
        return AuthBloc(
          authenticator: _FakeAuthenticator(),
          tokenStore: store,
          profileRepository:
              _FakeProfiles(() async => throw const SessionExpiredException()),
          onSessionExpired: expired.stream,
        );
      },
      act: (bloc) => bloc.add(const AuthBootstrapRequested()),
      expect: () => const [AuthSignedOut()],
    );

    blocTest<AuthBloc, AuthState>(
      'transient profile error -> signed out (this run)',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(),
        tokenStore: _FakeTokenStore(_tokens()),
        profileRepository: _FakeProfiles(
          () async => throw const ApiException('down', statusCode: 503),
        ),
        onSessionExpired: expired.stream,
      ),
      act: (bloc) => bloc.add(const AuthBootstrapRequested()),
      expect: () => const [AuthSignedOut()],
    );
  });

  group('login', () {
    blocTest<AuthBloc, AuthState>(
      'success + onboarded -> authenticating, authed; tokens persisted',
      build: () {
        final store = _FakeTokenStore();
        return AuthBloc(
          authenticator:
              _FakeAuthenticator(authenticateImpl: () async => _tokens()),
          tokenStore: store,
          profileRepository: _FakeProfiles(() async => _onboarded),
          onSessionExpired: expired.stream,
        );
      },
      act: (bloc) => bloc.add(const AuthLoginRequested()),
      expect: () => const [AuthAuthenticating(), AuthAuthed(_onboarded)],
    );

    blocTest<AuthBloc, AuthState>(
      'cancelled -> authenticating, signed out (no error)',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(
          authenticateImpl: () async => throw const AuthCancelledException(),
        ),
        tokenStore: _FakeTokenStore(),
        profileRepository: _FakeProfiles(() async => _onboarded),
        onSessionExpired: expired.stream,
      ),
      act: (bloc) => bloc.add(const AuthLoginRequested()),
      expect: () => const [AuthAuthenticating(), AuthSignedOut()],
    );

    blocTest<AuthBloc, AuthState>(
      'failure -> authenticating, signed out with message',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(
          authenticateImpl: () async => throw const AuthFailedException('boom'),
        ),
        tokenStore: _FakeTokenStore(),
        profileRepository: _FakeProfiles(() async => _onboarded),
        onSessionExpired: expired.stream,
      ),
      act: (bloc) => bloc.add(const AuthLoginRequested()),
      expect: () =>
          const [AuthAuthenticating(), AuthSignedOut(error: 'boom')],
    );
  });

  group('logout & expiry', () {
    blocTest<AuthBloc, AuthState>(
      'logout ends Cognito session, clears store, signs out',
      build: () {
        final store = _FakeTokenStore(_tokens());
        final auth = _FakeAuthenticator();
        return AuthBloc(
          authenticator: auth,
          tokenStore: store,
          profileRepository: _FakeProfiles(() async => _onboarded),
          onSessionExpired: expired.stream,
        );
      },
      act: (bloc) => bloc.add(const AuthLogoutRequested()),
      expect: () => const [AuthSignedOut()],
    );

    blocTest<AuthBloc, AuthState>(
      'session-expired signal from token provider -> signed out',
      build: () => AuthBloc(
        authenticator: _FakeAuthenticator(),
        tokenStore: _FakeTokenStore(),
        profileRepository: _FakeProfiles(() async => _onboarded),
        onSessionExpired: expired.stream,
      ),
      act: (_) => expired.add(null),
      wait: const Duration(milliseconds: 20),
      expect: () => const [AuthSignedOut()],
    );
  });
}
