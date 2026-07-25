import { describe, it, expect } from 'vitest'
import { assessImageQuality, qualityIssueMessage, type LuminanceSource } from './image-quality'

// Build an RGBA buffer from a per-pixel gray value function (r=g=b=gray, a=255).
function grayImage(width: number, height: number, gray: (x: number, y: number) => number): LuminanceSource {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const g = Math.max(0, Math.min(255, Math.round(gray(x, y))))
      const i = (y * width + x) * 4
      data[i] = g
      data[i + 1] = g
      data[i + 2] = g
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

// A sharp, well-exposed image: a high-contrast checkerboard around mid-grey.
const sharp = grayImage(32, 32, (x, y) => ((x + y) % 2 === 0 ? 40 : 210))

describe('assessImageQuality', () => {
  it('passes a sharp, well-exposed image', () => {
    expect(assessImageQuality(sharp)).toEqual({ ok: true, issues: [] })
  })

  it('flags a flat (blurred) image as BLURRY', () => {
    const flat = grayImage(32, 32, () => 128) // no edges → ~zero Laplacian variance
    const v = assessImageQuality(flat)
    expect(v.ok).toBe(false)
    expect(v.issues).toContain('BLURRY')
  })

  it('flags a washed-out image as GLARE', () => {
    // Mostly blown-out white with a little texture to keep it sharp.
    const glary = grayImage(32, 32, (x, y) => ((x + y) % 2 === 0 ? 250 : 255))
    const v = assessImageQuality(glary)
    expect(v.issues).toContain('GLARE')
  })

  it('flags a dark image as TOO_DARK', () => {
    const dark = grayImage(32, 32, (x, y) => ((x + y) % 2 === 0 ? 5 : 30)) // sharp but mean ~17
    const v = assessImageQuality(dark)
    expect(v.issues).toContain('TOO_DARK')
  })

  it('does not judge an empty image', () => {
    expect(assessImageQuality({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toEqual({ ok: true, issues: [] })
  })

  it('respects custom thresholds', () => {
    const flat = grayImage(32, 32, () => 128)
    // A permissive sharpness floor of 0 accepts the flat image.
    expect(assessImageQuality(flat, { minSharpness: 0, maxBrightFraction: 1, minMeanLuminance: 0 }).ok).toBe(true)
  })
})

describe('qualityIssueMessage', () => {
  it('is empty when there are no issues', () => {
    expect(qualityIssueMessage([])).toBe('')
  })

  it('names each issue and offers retake-or-override', () => {
    const msg = qualityIssueMessage(['BLURRY', 'GLARE'])
    expect(msg).toMatch(/blurry/)
    expect(msg).toMatch(/glare/)
    expect(msg).toMatch(/upload it anyway/)
  })
})
