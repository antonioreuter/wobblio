// Client-side receipt upload: compress to ≤1MB JPEG (re-encoding via canvas also
// strips EXIF/geotags), hash, then presign → PUT to S3 → confirm. Runs in the
// browser only. See webapp CLAUDE.md hard rule #8 + spec §6.6.

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

export async function uploadReceipt(file: File): Promise<{ invoiceId: string }> {
  const { blob, sha256 } = await prepareImage(file)

  const presign = await fetch('/api/invoices/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageSha256: sha256, contentType: 'image/jpeg' }),
  })
  if (presign.status === 409) throw new UploadError('duplicate', 'This receipt was already scanned.')
  if (presign.status === 429) throw new UploadError('quota', 'You’ve reached your weekly scan limit.')
  if (!presign.ok) throw new UploadError('failed', 'Could not start the upload.')

  const { invoiceId, uploadUrl } = (await presign.json()) as { invoiceId: string; uploadUrl: string }

  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
  if (!put.ok) throw new UploadError('failed', 'Uploading the photo failed.')

  const confirm = await fetch(`/api/invoices/${invoiceId}/confirm`, { method: 'POST' })
  if (!confirm.ok) throw new UploadError('failed', 'Could not start processing.')

  return { invoiceId }
}
