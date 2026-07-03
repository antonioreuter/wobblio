// Settings-page domain types mirroring the backend OnboardingProfile / DataRequestRecord /
// ExportDownload DTOs (camelCase). Wired to /api/me/* + /api/billing/* — no mock data.

export interface Profile {
  fullName: string
  country: string
  regionCode: string | null
  language: string
  currency: string
  birthdate: string | null
  onboarded: boolean
  role: 'STANDARD' | 'PREMIUM' | 'TESTER' | 'ADMIN'
  status: 'ACTIVE' | 'WAITLIST' | 'DELETED'
  priceContributionOptout: boolean
}

// PUT /me/profile reuses the completeOnboarding write path, so birthdate + consent
// must be carried through even though Settings doesn't let the user edit them.
export interface ProfileUpdateInput {
  fullName: string
  country: string
  regionCode: string
  language: string
  currency: string
  birthdate: string
  consent: boolean
}

export async function fetchProfile(): Promise<Profile> {
  const res = await fetch('/api/me/profile', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`)
  return (await res.json()) as Profile
}

export async function saveProfile(input: ProfileUpdateInput): Promise<void> {
  const res = await fetch('/api/me/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed to save profile (${res.status})`)
}

export async function setPriceContributionOptout(optout: boolean): Promise<void> {
  const res = await fetch('/api/me/price-contribution-optout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optout }),
  })
  if (!res.ok) throw new Error(`Failed to update opt-out (${res.status})`)
}

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface ExportRequest {
  id: string
  status: ExportStatus
  requestedAt: string
  completedAt: string | null
}

export class ExportRateLimitedError extends Error {}

// 429 (one export per tenant per 24h) is a normal, expected outcome — surfaced as a
// typed error so the caller can show a friendly toast instead of a generic failure.
export async function requestExport(): Promise<{ requestId: string }> {
  const res = await fetch('/api/me/export', { method: 'POST' })
  if (res.status === 429) throw new ExportRateLimitedError()
  if (!res.ok) throw new Error(`Failed to request export (${res.status})`)
  return (await res.json()) as { requestId: string }
}

export async function fetchLatestExport(): Promise<ExportRequest | null> {
  const res = await fetch('/api/me/export/latest', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load export status (${res.status})`)
  const data = (await res.json()) as { request: ExportRequest | null }
  return data.request
}

export type ExportDownloadStatus = ExportStatus | 'EXPIRED'

export async function fetchExportDownload(
  requestId: string,
): Promise<{ status: ExportDownloadStatus; downloadUrl: string | null }> {
  const res = await fetch(`/api/me/export/${requestId}/download`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to resolve download (${res.status})`)
  return (await res.json()) as { status: ExportDownloadStatus; downloadUrl: string | null }
}

// PREMIUM-only. Currently resolves to a mocked `mock://portal/{userId}` URL until Stripe
// is wired — the button still round-trips the real endpoint per product decision.
export async function fetchBillingPortalUrl(): Promise<string> {
  const res = await fetch('/api/billing/portal-session', { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to open billing portal (${res.status})`)
  const data = (await res.json()) as { portalUrl: string }
  return data.portalUrl
}
