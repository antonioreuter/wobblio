import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:wobblio/core/domain/image_quality.dart';

// Build an RGBA buffer from a per-pixel grey value function (grey → R=G=B, A=255).
LuminanceSource _grey(int width, int height, int Function(int x, int y) value) {
  final data = Uint8List(width * height * 4);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      final i = (y * width + x) * 4;
      final v = value(x, y).clamp(0, 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return LuminanceSource(data: data, width: width, height: height);
}

void main() {
  group('assessImageQuality', () {
    test('passes a sharp, well-lit, high-contrast image', () {
      // A checkerboard: strong edges (high Laplacian variance), mid-brightness, no glare.
      final src = _grey(32, 32, (x, y) => (x + y).isEven ? 40 : 200);
      final verdict = assessImageQuality(src);
      expect(verdict.ok, isTrue);
      expect(verdict.issues, isEmpty);
    });

    test('flags a flat (blur-equivalent) image as BLURRY', () {
      // A uniform mid-grey field has zero edge energy → Laplacian variance 0.
      final src = _grey(32, 32, (_, __) => 128);
      final verdict = assessImageQuality(src);
      expect(verdict.issues, contains(QualityIssue.blurry));
    });

    test('flags a washed-out image as GLARE', () {
      // Mostly blown-out (250) with a little edge texture so it is not also "blurry".
      final src = _grey(32, 32, (x, y) => (x + y).isEven ? 250 : 255);
      final verdict = assessImageQuality(src);
      expect(verdict.issues, contains(QualityIssue.glare));
    });

    test('flags a dark image as TOO_DARK', () {
      final rnd = Random(1);
      // Dark but textured (mean well below the 42 floor) so darkness — not blur — is the flag.
      final src = _grey(32, 32, (_, __) => rnd.nextInt(20));
      final verdict = assessImageQuality(src);
      expect(verdict.issues, contains(QualityIssue.tooDark));
    });

    test('does not judge a too-small image (fails open)', () {
      final src = _grey(2, 2, (_, __) => 128);
      expect(assessImageQuality(src).ok, isTrue);
    });
  });

  group('qualityIssueMessage', () {
    test('is empty for no issues', () {
      expect(qualityIssueMessage(const []), isEmpty);
    });

    test('renders an actionable retake tip that nudges laying the receipt flat', () {
      final msg = qualityIssueMessage(const [QualityIssue.blurry]);
      expect(msg, contains('blurry'));
      expect(msg, contains('Lay the receipt flat'));
      expect(msg, contains('upload it anyway'));
    });
  });
}
