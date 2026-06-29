// Client-side receipt upload: compress to ≤1MB JPEG (re-encoding via canvas also
// strips EXIF/geotags), hash, then presign → multipart POST to S3 → confirm. Runs in
// the browser only. See webapp CLAUDE.md hard rule #8 + spec §6.6.

const MAX_BYTES = 1_000_000
const MAX_DIMENSION = 1600
const MIN_QUALITY = 0.4

export type UploadErrorCode = 'duplicate' | 'quota' | 'failed'

export class UploadError extends Error {
  constructor(readonly code: UploadErrorCode, message: string) {
    super(message)
    this.name = 'UploadError'
  }
}

export interface PreparedImage {
  blob: Blob
  sha256: string
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new UploadError('failed', 'Image encoding failed'))),
      'image/jpeg',
      quality,
    )
  })
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new UploadError('failed', 'Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let quality = 0.9
  let blob = await encodeJpeg(canvas, quality)
  while (blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1
    blob = await encodeJpeg(canvas, quality)
  }

  const sha256 = await sha256Hex(await blob.arrayBuffer())
  return { blob, sha256 }
}

// Tier-2 upload location (§6.5): ask the browser where we are so the backend can
// prefill the location gate when the receipt itself carries no address. Best-effort —
// a denied/unsupported/slow permission just skips it (resolves undefined), and the raw
// coordinates are reverse-geocoded server-side at presign, never persisted.
function getUploadCoordinates(): Promise<{ lat: number; lon: number } | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000, maximumAge: 600_000 },
    )
  })
}

const MAX_PDF_BYTES = 4_500_000 // mirrors the backend /quotas/max_pdf_bytes (§06, Bedrock doc limit); S3 also enforces it

// A PDF is uploaded as-is (no canvas re-encode): there is no EXIF/geotag to strip and
// rasterizing would lose the native text. Images still go through prepareImage.
async function prepareUpload(file: File): Promise<{ blob: Blob; sha256: string; contentType: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new UploadError('failed', 'This PDF is too large (max 4.5 MB).')
    const sha256 = await sha256Hex(await file.arrayBuffer())
    return { blob: file, sha256, contentType: 'application/pdf' }
  }
  const { blob, sha256 } = await prepareImage(file)
  return { blob, sha256, contentType: 'image/jpeg' }
}

export async function uploadReceipt(file: File): Promise<{ invoiceId: string }> {
  const { blob, sha256, contentType } = await prepareUpload(file)
  const coordinates = await getUploadCoordinates()

  const presign = await fetch('/api/invoices/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageSha256: sha256, contentType, ...coordinates }),
  })
  if (presign.status === 409) throw new UploadError('duplicate', 'This receipt was already scanned.')
  if (presign.status === 429) throw new UploadError('quota', 'You’ve reached your weekly usage credit limit.')
  if (presign.status === 403) throw new UploadError('failed', 'PDF uploads require a premium plan.')
  if (!presign.ok) throw new UploadError('failed', 'Could not start the upload.')

  const { invoiceId, url, fields } = (await presign.json()) as {
    invoiceId: string
    url: string
    fields: Record<string, string>
  }

  // Presigned multipart POST: submit the signed fields (policy, signature, key, Content-Type,
  // content-length-range) and the file last. S3 rejects an oversize body before it lands (§06).
  // No explicit Content-Type header — the browser sets the multipart boundary itself.
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  // A filename is required for S3 to treat the `file` part as an object upload.
  form.append('file', blob, contentType === 'application/pdf' ? 'receipt.pdf' : 'receipt.jpg')

  const post = await fetch(url, { method: 'POST', body: form })
  if (!post.ok) throw new UploadError('failed', 'Uploading the file failed.')

  const confirm = await fetch(`/api/invoices/${invoiceId}/confirm`, { method: 'POST' })
  if (!confirm.ok) throw new UploadError('failed', 'Could not start processing.')

  return { invoiceId }
}
