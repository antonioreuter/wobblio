import { SharedSplitView, type SharedSplit } from './shared-split-view'

// Public, unauthenticated page (allowlisted in middleware). Resolves the split share
// token server-side against the backend's public /shared-splits/{token} route.
export const dynamic = 'force-dynamic'

async function fetchSharedSplit(token: string): Promise<SharedSplit | null> {
  const base = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  if (!base) return null
  const res = await fetch(`${base}/shared-splits/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as SharedSplit
}

export default async function SharedSplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const split = await fetchSharedSplit(token)
  return <SharedSplitView split={split} />
}
