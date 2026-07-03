import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/jwt_claims.dart';

// A real Cognito JWT's base64url segments never carry `=` padding — build
// fixtures the same way so the padding-restoration path is genuinely exercised.
String _segment(Object value) =>
    base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');

String _jwt(Map<String, dynamic> claims) =>
    '${_segment({'alg': 'none'})}.${_segment(claims)}.signature';

void main() {
  group('decodeIdTokenClaims', () {
    test('decodes a valid, padding-less base64url token', () {
      final token = _jwt({'email': 'anna@example.com', 'sub': 'abc-123'});
      final claims = decodeIdTokenClaims(token);
      expect(claims['email'], 'anna@example.com');
      expect(claims['sub'], 'abc-123');
    });

    test('a token without 3 dot-separated segments returns an empty map', () {
      expect(decodeIdTokenClaims('not-a-jwt'), <String, dynamic>{});
      expect(decodeIdTokenClaims('only.two'), <String, dynamic>{});
      expect(decodeIdTokenClaims('a.b.c.d'), <String, dynamic>{});
    });

    test('a payload segment that is not valid base64/JSON returns an empty map',
        () {
      const token = 'header.@@@not-base64@@@.signature';
      expect(decodeIdTokenClaims(token), <String, dynamic>{});
    });

    test('a payload segment whose JSON is not an object returns an empty map',
        () {
      final token = 'header.${_segment(['not', 'an', 'object'])}.signature';
      expect(decodeIdTokenClaims(token), <String, dynamic>{});
    });

    test(
        'a valid token missing the email claim yields a null email, not a throw',
        () {
      final token = _jwt({'sub': 'abc-123'});
      final claims = decodeIdTokenClaims(token);
      expect(() => claims['email'] as String?, returnsNormally);
      expect(claims['email'], isNull);
    });

    test('empty string input returns an empty map, not a throw', () {
      expect(decodeIdTokenClaims(''), <String, dynamic>{});
    });
  });
}
