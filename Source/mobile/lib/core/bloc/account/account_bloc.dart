import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/auth/jwt_claims.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

part 'account_event.dart';
part 'account_state.dart';

/// Owns the Account screen (18f): loads the caller's profile
/// (`IProfileRepository.fetchProfile()`) and the persisted Cognito token
/// bundle (`ISecureTokenStore.read()`) concurrently, then decodes the
/// `email` claim out of the ID token — `GET /me/profile` has no email field.
/// Sign-out is deliberately **not** an event here: the screen dispatches the
/// app-wide `AuthBloc`'s existing `AuthLogoutRequested` event directly, since
/// that bloc (not this screen-scoped one) owns the session lifecycle that
/// `AuthGate` reacts to. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class AccountBloc extends Bloc<AccountEvent, AccountState> {
  AccountBloc({
    required IProfileRepository profile,
    required ISecureTokenStore tokenStore,
  })  : _profile = profile,
        _tokenStore = tokenStore,
        super(const AccountState()) {
    on<AccountStarted>(_onStarted);
  }

  final IProfileRepository _profile;
  final ISecureTokenStore _tokenStore;

  Future<void> _onStarted(
    AccountStarted event,
    Emitter<AccountState> emit,
  ) async {
    emit(state.copyWith(status: AccountStatus.loading));
    try {
      final results = await Future.wait<Object?>([
        _profile.fetchProfile(),
        _tokenStore.read(),
      ]);
      final profile = results[0] as UserProfile;
      final tokens = results[1] as AuthTokens?;
      emit(
        state.copyWith(
          status: AccountStatus.ready,
          profile: profile,
          email: _emailFrom(tokens),
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: AccountStatus.failure));
    }
  }

  // No stored session, or a token whose ID-token payload doesn't carry an
  // `email` claim (or isn't a JWT at all) — both degrade to a null email
  // rather than failing the whole screen load.
  String? _emailFrom(AuthTokens? tokens) {
    if (tokens == null) return null;
    return decodeIdTokenClaims(tokens.idToken)['email'] as String?;
  }
}
