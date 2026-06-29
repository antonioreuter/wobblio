part of 'auth_bloc.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

/// Fired once at startup: restore a persisted session (if any) and gate.
class AuthBootstrapRequested extends AuthEvent {
  const AuthBootstrapRequested();
}

/// The user tapped "Sign in" — launch the Hosted-UI flow.
class AuthLoginRequested extends AuthEvent {
  const AuthLoginRequested();
}

/// The user signed out explicitly.
class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

/// Silent refresh failed downstream (emitted by the token provider) — the
/// session can no longer be renewed, so force re-login.
class AuthSessionExpired extends AuthEvent {
  const AuthSessionExpired();
}
