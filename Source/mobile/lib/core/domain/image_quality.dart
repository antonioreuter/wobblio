import 'dart:typed_data';

/// Client-side capture-quality gate (fix 11 · sub-spec 05, mobile mirror of the webapp's
/// `Source/webapp/src/lib/image-quality.ts`). Deterministic, no AI, no network: assess a
/// receipt photo's legibility BEFORE presign/upload so a blurry/glary/dark shot is caught
/// while the user can still retake it — no credit spent, no pipeline run.
///
/// Pure over pixel luminance so it unit-tests headless (no `dart:ui`); the decode glue that
/// turns JPEG bytes into a [LuminanceSource] lives in the infrastructure adapter.
enum QualityIssue { blurry, glare, tooDark }

class QualityVerdict {
  const QualityVerdict({required this.ok, required this.issues});

  final bool ok;
  final List<QualityIssue> issues;
}

/// Minimal image shape so callers/tests need no Flutter engine: RGBA bytes + dimensions.
class LuminanceSource {
  const LuminanceSource({
    required this.data,
    required this.width,
    required this.height,
  });

  final Uint8List data; // RGBA, 4 bytes per pixel
  final int width;
  final int height;
}

class QualityThresholds {
  const QualityThresholds({
    required this.minSharpness,
    required this.maxBrightFraction,
    required this.minMeanLuminance,
  });

  final double minSharpness; // Laplacian-response variance; below → blurry
  final double maxBrightFraction; // share of near-white pixels above which → glare/washout
  final double minMeanLuminance; // mean luminance below which → too dark
}

/// Conservative defaults — bias toward NOT flagging (a false block is worse UX than a rare
/// miss; the capture flow also offers an override). Mirrors the webapp constants. Tune from
/// real capture telemetry.
const QualityThresholds kDefaultQualityThresholds = QualityThresholds(
  minSharpness: 55,
  maxBrightFraction: 0.35,
  minMeanLuminance: 42,
);

const double _brightLevel = 245; // luminance counted as "blown out"

Float32List _toLuminance(LuminanceSource src) {
  final data = src.data;
  final lum = Float32List(src.width * src.height);
  for (var p = 0, i = 0; p < lum.length; p++, i += 4) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return lum;
}

/// Variance of the 4-neighbour Laplacian response — the standard focus measure. A sharp image
/// has strong edges (high variance); a blurred one is smooth (low variance).
double _laplacianVariance(Float32List lum, int width, int height) {
  if (width < 3 || height < 3) return double.infinity; // too small to judge → don't flag
  var sum = 0.0;
  var sumSq = 0.0;
  var n = 0;
  for (var y = 1; y < height - 1; y++) {
    for (var x = 1; x < width - 1; x++) {
      final i = y * width + x;
      final lap = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n == 0) return double.infinity;
  final mean = sum / n;
  return sumSq / n - mean * mean;
}

QualityVerdict assessImageQuality(
  LuminanceSource src, {
  QualityThresholds thresholds = kDefaultQualityThresholds,
}) {
  final lum = _toLuminance(src);
  if (lum.isEmpty) return const QualityVerdict(ok: true, issues: []); // nothing to judge

  var total = 0.0;
  var bright = 0;
  for (var p = 0; p < lum.length; p++) {
    total += lum[p];
    if (lum[p] >= _brightLevel) bright++;
  }
  final meanLuminance = total / lum.length;
  final brightFraction = bright / lum.length;
  final sharpness = _laplacianVariance(lum, src.width, src.height);

  final issues = <QualityIssue>[];
  if (sharpness < thresholds.minSharpness) issues.add(QualityIssue.blurry);
  if (brightFraction > thresholds.maxBrightFraction) issues.add(QualityIssue.glare);
  if (meanLuminance < thresholds.minMeanLuminance) issues.add(QualityIssue.tooDark);
  return QualityVerdict(ok: issues.isEmpty, issues: issues);
}

const Map<QualityIssue, String> _tips = {
  QualityIssue.blurry: 'the photo looks blurry — hold steady and make sure the text is in focus',
  QualityIssue.glare: 'there’s glare washing out part of the receipt — angle it away from direct light',
  QualityIssue.tooDark: 'the photo is too dark to read — retake it in brighter, even light',
};

/// One user-facing sentence for a verdict's issues. Also nudges flattening a long receipt, the
/// most common cause of an unreadable capture the pixel checks can't see.
String qualityIssueMessage(List<QualityIssue> issues) {
  if (issues.isEmpty) return '';
  final reasons = issues.map((i) => _tips[i]).join('; and ');
  return 'This photo may not read well: $reasons. Lay the receipt flat and retake, or upload it anyway.';
}
