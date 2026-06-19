import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { uploadReceipt } from './upload-receipt'

// Stub the browser image pipeline (createImageBitmap + canvas + WebCrypto) so
// prepareImage runs headless; these tests target the geolocation → presign body wiring.
function stubImagePipeline() {
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }) as never
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as never
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: BlobCallback) {
    cb(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }))
  }) as never
  // jsdom's Blob has no arrayBuffer(); prepareImage hashes the blob bytes.
  if (!('arrayBuffer' in Blob.prototype)) {
    Blob.prototype.arrayBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer) as never
  }
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } },
  })
}

function mockUploadFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/invoices/presign')) {
      return { ok: true, status: 201, json: async () => ({ invoiceId: 'inv-1', uploadUrl: 'https://s3/put' }) } as Response
    }
    return { ok: true, status: 200, json: async () => ({}) } as Response
  })
  global.fetch = fetchMock as never
  return fetchMock
}

const presignBody = (fetchMock: ReturnType<typeof vi.fn>) => {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/api/invoices/presign'))!
  return JSON.parse((call[1] as RequestInit).body as string)
}

describe('uploadReceipt geolocation', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    stubImagePipeline()
    fetchMock = mockUploadFetch()
  })
  afterEach(() => vi.restoreAllMocks())

  it('includes coordinates in the presign body when geolocation is granted', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 51.4, longitude: 5.5 } } as GeolocationPosition) },
    })

    await uploadReceipt(new File(['x'], 'receipt.jpg', { type: 'image/jpeg' }))

    expect(presignBody(fetchMock)).toMatchObject({ lat: 51.4, lon: 5.5, imageSha256: expect.any(String) })
  })

  it('omits coordinates and still uploads when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) => err({ code: 1 } as GeolocationPositionError) },
    })

    const result = await uploadReceipt(new File(['x'], 'receipt.jpg', { type: 'image/jpeg' }))

    const body = presignBody(fetchMock)
    expect(body.lat).toBeUndefined()
    expect(body.lon).toBeUndefined()
    expect(result).toEqual({ invoiceId: 'inv-1' })
  })

  it('omits coordinates when geolocation is unsupported', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })

    await uploadReceipt(new File(['x'], 'receipt.jpg', { type: 'image/jpeg' }))

    expect(presignBody(fetchMock).lat).toBeUndefined()
  })
})
