// Client-side capture-quality gate (fix 11 · sub-spec 05). Deterministic, no AI, no network:
// assess a receipt photo's legibility BEFORE presign/upload so a blurry/glary/dark shot is
// caught while the user can still retake it — no credit spent, no pipeline run. Pure functions
// over pixel luminance so they unit-test headless; the browser glue lives in upload-receipt.ts.

export type QualityIssue = 'BLURRY' | 'GLARE' | 'TOO_DARK'

export interface QualityVerdict {
  ok: boolean
  issues: QualityIssue[]
}

// Minimal ImageData shape so callers/tests need no DOM (jsdom can't construct ImageData).
export interface LuminanceSource {
  data: Uint8ClampedArray | number[]
  width: number
  height: number
}

export interface QualityThresholds {
  minSharpness: number // Laplacian-response variance; below → blurry
  maxBrightFraction: number // share of near-white pixels above which → glare/washout
  minMeanLuminance: number // mean luminance below which → too dark
}

// Conservative defaults — bias toward NOT flagging (a false block is worse UX than a rare miss;
// the upload path also offers an override). Tune from real capture telemetry.
export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  minSharpness: 55,
  maxBrightFraction: 0.35,
  minMeanLuminance: 42,
}

const BRIGHT_LEVEL = 245 // luminance counted as "blown out"

// Rec. 601 luma from RGBA, one byte per pixel.
function toLuminance(src: LuminanceSource): Float32Array {
  const { data, width, height } = src
  const lum = new Float32Array(width * height)
  for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return lum
}

// Variance of the 4-neighbour Laplacian response — the standard focus measure. A sharp image
// has strong edges (high variance); a blurred one is smooth (low variance).
function laplacianVariance(lum: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return Number.POSITIVE_INFINITY // too small to judge → don't flag
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (n === 0) return Number.POSITIVE_INFINITY
  const mean = sum / n
  return sumSq / n - mean * mean
}

export function assessImageQuality(
  src: LuminanceSource,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
): QualityVerdict {
  const lum = toLuminance(src)
  if (lum.length === 0) return { ok: true, issues: [] } // nothing to judge → don't block

  let total = 0
  let bright = 0
  for (let p = 0; p < lum.length; p++) {
    total += lum[p]
    if (lum[p] >= BRIGHT_LEVEL) bright++
  }
  const meanLuminance = total / lum.length
  const brightFraction = bright / lum.length
  const sharpness = laplacianVariance(lum, src.width, src.height)

  const issues: QualityIssue[] = []
  if (sharpness < thresholds.minSharpness) issues.push('BLURRY')
  if (brightFraction > thresholds.maxBrightFraction) issues.push('GLARE')
  if (meanLuminance < thresholds.minMeanLuminance) issues.push('TOO_DARK')
  return { ok: issues.length === 0, issues }
}

const TIPS: Record<QualityIssue, string> = {
  BLURRY: 'the photo looks blurry — hold steady and make sure the text is in focus',
  GLARE: 'there’s glare washing out part of the receipt — angle it away from direct light',
  TOO_DARK: 'the photo is too dark to read — retake it in brighter, even light',
}

// One user-facing sentence for a verdict's issues. Also nudges flattening a long receipt, the
// most common cause of an unreadable capture that the pixel checks can't see.
export function qualityIssueMessage(issues: QualityIssue[]): string {
  if (issues.length === 0) return ''
  const reasons = issues.map((i) => TIPS[i]).join('; and ')
  return `This photo may not read well: ${reasons}. Lay the receipt flat and retake, or upload it anyway.`
}
