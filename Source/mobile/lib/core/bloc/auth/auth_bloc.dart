import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/auth/auth_exception.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

part 'auth_event.dart';
part 'auth_state.dart';

/// Owns session state and drives the app router (signed-out / authenticating /
/// authed / onboarding-required). It depends on ports only — the Hosted-UI
/// handshake, secure storage, and profile HTTP all live behind abstractions.
///
/// Silent refresh is handled lower down by the token provider on each API call;
/// when refresh can no longer succeed it signals [onSessionExpired], which this
/// bloc turns into a forced re-login (mirrors the webapp's `ForceSignOut`).
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required ICognitoAuthenticator authenticator,
    required ISecureTokenStore tokenStore,
    required IProfileRepository profileRepository,
    required Stream<void> onSessionExpired,
  })  : _authenticator = authenticator,
        _tokenStore = tokenStore,
        _profiles = profileRepository,
        super(const AuthInitial()) {
    on<AuthBootstrapRequested>(_onBootstrap);
    on<AuthLoginRequested>(_onLogin);
    on<AuthLogoutRequested>(_onLogout);
    on<AuthSessionExpired>(_onSessionExpired);

    _expirySub =
        onSessionExpired.listen((_) => add(const AuthSessionExpired()));
  }

  final ICognitoAuthenticator _authenticator;
  final ISecureTokenStore _tokenStore;
  final IProfileRepository _profiles;
  late final StreamSubscription<void> _expirySub;

  Future<void> _onBootstrap(
    AuthBootstrapRequested event,
    Emitter<AuthState> emit,
  ) async {
    final tokens = await _tokenStore.read();
    if (tokens == null) {
      emit(const AuthSignedOut());
      return;
    }
    // A session is persisted — let the profile fetch (which silently refreshes
    // through the token provider) decide whether it is still usable.
    try {
      emit(_gate(await _profiles.fetchProfile()));
    } on SessionExpiredException {
      await _tokenStore.clear();
      emit(const AuthSignedOut());
    } on ApiException catch (error) {
      if (error.isUnauthorized) {
        await _tokenStore.clear();
      }
      // Transient (network) errors keep the persisted tokens so the next launch
      // can recover, but we still land on the sign-in screen this run.
      emit(const AuthSignedOut());
    }
  }

  Future<void> _onLogin(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthAuthenticating());
    try {
      final tokens = await _authenticator.authenticate();
      await _tokenStore.write(tokens);
      emit(_gate(await _profiles.fetchProfile()));
    } on AuthCancelledException {
      emit(const AuthSignedOut());
    } on AuthException catch (error) {
      emit(AuthSignedOut(error: error.message));
    } on ApiException {
      // Signed in at Cognito but the profile read failed — surface it and let
      // the user retry; the written tokens let the next attempt bootstrap.
      emit(const AuthSignedOut(
          error: 'Signed in, but could not load your profile. Try again.',),);
    }
  }

  Future<void> _onLogout(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    final tokens = await _tokenStore.read();
    if (tokens != null) {
      try {
        await _authenticator.endSession(tokens.idToken);
      } on AuthException {
        // Best-effort SSO sign-out; clearing local tokens is what matters.
      }
    }
    await _tokenStore.clear();
    emit(const AuthSignedOut());
  }

  Future<void> _onSessionExpired(
    AuthSessionExpired event,
    Emitter<AuthState> emit,
  ) async {
    // The token provider has already cleared the store on refresh failure.
    emit(const AuthSignedOut());
  }

  AuthState _gate(UserProfile profile) =>
      profile.onboarded ? AuthAuthed(profile) : AuthOnboardingRequired(profile);

  @override
  Future<void> close() {
    _expirySub.cancel();
    return super.close();
  }
}
