import 'dart:convert';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/auth_tokens.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/account/account_bloc.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
String _base64UrlNoPad(Object value) =>
    base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');

String _jwt(Map<String, dynamic> claims) =>
    '${_base64UrlNoPad({'alg': 'none'})}.${_base64UrlNoPad(claims)}.signature';

UserProfile _defaultProfile({String role = 'STANDARD'}) => UserProfile(
      onboarded: true,
      fullName: 'Anna Smit',
      role: role,
      status: 'ACTIVE',
    );

AuthTokens _tokens(String idToken) => AuthTokens(
      idToken: idToken,
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
    );

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeProfileRepository implements IProfileRepository {
  _FakeProfileRepository({UserProfile? profile, this.fails = false})
      : _profile = profile ?? _defaultProfile();
  final UserProfile _profile;
  final bool fails;

  @override
  Future<UserProfile> fetchProfile() async {
    if (fails) throw Exception('boom');
    return _profile;
  }
}

class _FakeTokenStore implements ISecureTokenStore {
  _FakeTokenStore({AuthTokens? tokens, this.fails = false}) : _tokens = tokens;
  final AuthTokens? _tokens;
  final bool fails;

  @override
  Future<AuthTokens?> read() async {
    if (fails) throw Exception('boom');
    return _tokens;
  }

  @override
  Future<void> write(AuthTokens tokens) async {}

  @override
  Future<void> clear() async {}
}

void main() {
  group('AccountBloc', () {
    blocTest<AccountBloc, AccountState>(
      'loads profile + decodes email from the id token concurrently',
      build: () => AccountBloc(
        profile: _FakeProfileRepository(),
        tokenStore: _FakeTokenStore(
          tokens: _tokens(_jwt({'email': 'anna@example.com'})),
        ),
      ),
      act: (bloc) => bloc.add(const AccountStarted()),
      expect: () => [
        isA<AccountState>()
            .having((s) => s.status, 'status', AccountStatus.loading),
        isA<AccountState>()
            .having((s) => s.status, 'status', AccountStatus.ready)
            .having((s) => s.profile?.fullName, 'profile', 'Anna Smit')
            .having((s) => s.email, 'email', 'anna@example.com'),
      ],
    );

    blocTest<AccountBloc, AccountState>(
      'profile-fetch failure surfaces a failure status',
      build: () => AccountBloc(
        profile: _FakeProfileRepository(fails: true),
        tokenStore: _FakeTokenStore(
          tokens: _tokens(_jwt({'email': 'anna@example.com'})),
        ),
      ),
      act: (bloc) => bloc.add(const AccountStarted()),
      skip: 1,
      expect: () => [
        isA<AccountState>()
            .having((s) => s.status, 'status', AccountStatus.failure),
      ],
    );

    blocTest<AccountBloc, AccountState>(
      'token-read failure surfaces a failure status',
      build: () => AccountBloc(
        profile: _FakeProfileRepository(),
        tokenStore: _FakeTokenStore(fails: true),
      ),
      act: (bloc) => bloc.add(const AccountStarted()),
      skip: 1,
      expect: () => [
        isA<AccountState>()
            .having((s) => s.status, 'status', AccountStatus.failure),
      ],
    );

    blocTest<AccountBloc, AccountState>(
      'no stored session (null tokens) still reaches ready with a null email',
      build: () => AccountBloc(
        profile: _FakeProfileRepository(),
        tokenStore: _FakeTokenStore(),
      ),
      act: (bloc) => bloc.add(const AccountStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, AccountStatus.ready);
        expect(bloc.state.email, isNull);
      },
    );

    blocTest<AccountBloc, AccountState>(
      'a malformed id token degrades to ready with a null email, not a crash',
      build: () => AccountBloc(
        profile: _FakeProfileRepository(),
        tokenStore: _FakeTokenStore(tokens: _tokens('not-a-real-jwt')),
      ),
      act: (bloc) => bloc.add(const AccountStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, AccountStatus.ready);
        expect(bloc.state.email, isNull);
      },
    );

    blocTest<AccountBloc, AccountState>(
      'a valid token with no email claim still reaches ready with a null email',
      build: () => AccountBloc(
        profile: _FakeProfileRepository(),
        tokenStore: _FakeTokenStore(tokens: _tokens(_jwt({'sub': 'abc-123'}))),
      ),
      act: (bloc) => bloc.add(const AccountStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, AccountStatus.ready);
        expect(bloc.state.email, isNull);
      },
    );
  });
}
