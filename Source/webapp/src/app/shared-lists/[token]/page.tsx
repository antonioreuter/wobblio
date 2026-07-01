import { SharedListView, type SharedList } from './shared-list-view'

// Public, unauthenticated page (allowlisted in middleware, §10b). Resolves the
// share token server-side against the backend's public /shared-lists/{token}
// route for the first paint; subsequent checkbox toggles happen client-side.
export const dynamic = 'force-dynamic'

async function fetchSharedList(token: string): Promise<SharedList | null> {
  const base = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  if (!base) return null
  const res = await fetch(`${base}/shared-lists/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as SharedList
}

export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const list = await fetchSharedList(token)
  return <SharedListView token={token} initialList={list} />
}
