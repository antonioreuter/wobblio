import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ExportRateLimitedError,
  fetchBillingPortalUrl,
  fetchExportDownload,
  fetchLatestExport,
  fetchProfile,
  requestExport,
  saveProfile,
  setPriceContributionOptout,
} from './settings-data'

afterEach(() => vi.unstubAllGlobals())

describe('fetchProfile', () => {
  it('returns the profile payload', async () => {
    const profile = { fullName: 'Ada', country: 'NL', priceContributionOptout: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => profile }))
    await expect(fetchProfile()).resolves.toEqual(profile)
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(fetchProfile()).rejects.toThrow(/500/)
  })
})

describe('saveProfile', () => {
  it('PUTs the profile fields, including the carried-through birthdate/consent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      fullName: 'Ada Lovelace', country: 'NL', regionCode: 'NL-NB', language: 'nl',
      currency: 'EUR', birthdate: '1990-12-10', consent: true,
    }
    await saveProfile(input)

    expect(fetchMock).toHaveBeenCalledWith('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))
    await expect(saveProfile({
      fullName: '', country: '', regionCode: '', language: '', currency: '', birthdate: '', consent: true,
    })).rejects.toThrow(/400/)
  })
})

describe('setPriceContributionOptout', () => {
  it('PUTs the optout flag', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await setPriceContributionOptout(true)

    expect(fetchMock).toHaveBeenCalledWith('/api/me/price-contribution-optout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optout: true }),
    })
  })
})

describe('requestExport', () => {
  it('returns the requestId on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({ requestId: 'req-1' }) }))
    await expect(requestExport()).resolves.toEqual({ requestId: 'req-1' })
  })

  it('throws ExportRateLimitedError on a 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    await expect(requestExport()).rejects.toBeInstanceOf(ExportRateLimitedError)
  })

  it('throws a generic error on other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(requestExport()).rejects.toThrow(/500/)
  })
})

describe('fetchLatestExport', () => {
  it('unwraps the request envelope', async () => {
    const request = { id: 'req-1', status: 'COMPLETED', requestedAt: '2026-07-01', completedAt: '2026-07-01' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ request }) }))
    await expect(fetchLatestExport()).resolves.toEqual(request)
  })

  it('returns null when no export has been requested', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ request: null }) }))
    await expect(fetchLatestExport()).resolves.toBeNull()
  })
})

describe('fetchExportDownload', () => {
  it('requests the by-id download endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ status: 'COMPLETED', downloadUrl: 'https://example.test/x.zip' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchExportDownload('req-1')).resolves.toEqual({
      status: 'COMPLETED', downloadUrl: 'https://example.test/x.zip',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/me/export/req-1/download', { cache: 'no-store' })
  })

  it('surfaces an EXPIRED status with a null url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'EXPIRED', downloadUrl: null }) }))
    await expect(fetchExportDownload('req-1')).resolves.toEqual({ status: 'EXPIRED', downloadUrl: null })
  })
})

describe('fetchBillingPortalUrl', () => {
  it('returns the portal URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ portalUrl: 'mock://portal/u-1' }) }))
    await expect(fetchBillingPortalUrl()).resolves.toBe('mock://portal/u-1')
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(fetchBillingPortalUrl()).rejects.toThrow(/403/)
  })
})
