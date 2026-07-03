import 'dart:convert';

/// Decodes the claims (payload segment) of a Cognito-issued JWT for
/// **display only** — no signature verification is performed. The token has
/// already been through Cognito auth to reach this point (see
/// `ISecureTokenStore`); this is purely a convenience for reading claims like
/// `email` out of it, never a trust boundary.
///
/// A JWT is three base64url segments (`header.payload.signature`) joined by
/// `.`. JWT base64url segments routinely omit the `=` padding standard
/// base64 requires, so the payload is padded to a multiple of 4 before
/// decoding. Never throws — any malformed token (wrong segment count, bad
/// base64, non-JSON payload, or a payload that isn't a JSON object) yields an
/// empty map so callers can safely do `claims['email'] as String?`.
Map<String, dynamic> decodeIdTokenClaims(String idToken) {
  final segments = idToken.split('.');
  if (segments.length != 3) return const {};
  try {
    final payloadBytes = base64Url.decode(_withBase64Padding(segments[1]));
    final decoded = jsonDecode(utf8.decode(payloadBytes));
    if (decoded is! Map<String, dynamic>) return const {};
    return decoded;
  } catch (_) {
    return const {};
  }
}

String _withBase64Padding(String base64UrlSegment) {
  final remainder = base64UrlSegment.length % 4;
  if (remainder == 0) return base64UrlSegment;
  return base64UrlSegment + ('=' * (4 - remainder));
}
