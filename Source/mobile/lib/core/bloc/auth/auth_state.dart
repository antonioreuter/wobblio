part of 'auth_bloc.dart';

sealed class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

/// Startup splash while the persisted session is being restored.
class AuthInitial extends AuthState {
  const AuthInitial();
}

/// A Hosted-UI sign-in is in flight.
class AuthAuthenticating extends AuthState {
  const AuthAuthenticating();
}

/// No valid session. [error] carries a one-line message when a just-attempted
/// sign-in failed (null after an ordinary sign-out / cold start).
class AuthSignedOut extends AuthState {
  const AuthSignedOut({this.error});

  final String? error;

  @override
  List<Object?> get props => [error];
}

/// Signed in and onboarded — the app shell is shown.
class AuthAuthed extends AuthState {
  const AuthAuthed(this.profile);

  final UserProfile profile;

  @override
  List<Object?> get props => [profile];
}

/// Signed in but `onboarded` is false — route to onboarding.
class AuthOnboardingRequired extends AuthState {
  const AuthOnboardingRequired(this.profile);

  final UserProfile profile;

  @override
  List<Object?> get props => [profile];
}
