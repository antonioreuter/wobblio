import 'package:equatable/equatable.dart';

/// The Cognito token bundle held for the signed-in session.
///
/// The [idToken] is what authenticated API calls send as `Authorization:
/// Bearer` — the API Gateway authorizer expects the ID token, not the access
/// token (see memory `infra-gotchas`). [refreshToken] drives silent refresh;
/// [accessTokenExpiresAt] is when the access/ID token lapses.
class AuthTokens extends Equatable {
  const AuthTokens({
    required this.idToken,
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
  });

  final String idToken;
  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiresAt;

  /// True when the access token has lapsed (or will within [skew]) — the cue to
  /// refresh proactively before the next API call rather than waiting for a 401.
  bool isExpired({Duration skew = const Duration(seconds: 60)}) =>
      DateTime.now().add(skew).isAfter(accessTokenExpiresAt);

  AuthTokens copyWith({
    String? idToken,
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
  }) =>
      AuthTokens(
        idToken: idToken ?? this.idToken,
        accessToken: accessToken ?? this.accessToken,
        refreshToken: refreshToken ?? this.refreshToken,
        accessTokenExpiresAt: accessTokenExpiresAt ?? this.accessTokenExpiresAt,
      );

  Map<String, dynamic> toJson() => {
        'idToken': idToken,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'accessTokenExpiresAt': accessTokenExpiresAt.toIso8601String(),
      };

  static AuthTokens fromJson(Map<String, dynamic> json) => AuthTokens(
        idToken: json['idToken'] as String,
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        accessTokenExpiresAt:
            DateTime.parse(json['accessTokenExpiresAt'] as String),
      );

  @override
  List<Object?> get props =>
      [idToken, accessToken, refreshToken, accessTokenExpiresAt];
}
