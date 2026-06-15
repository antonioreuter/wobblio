import { NextResponse } from 'next/server'

// BFF proxy: forwards the public waitlist-status check to the backend
// /waitlist/status route. Same path locally (:3001) and on AWS (API Gateway →
// apiHandler). Routed server-side so the backend base URL is resolved at
// runtime (API_BASE_URL) rather than build-time inlined — otherwise the
// OpenNext build bakes .env.local's localhost value into the client bundle.
export async function GET() {
  // Prefer the runtime server-only var (set on AWS); fall back to the
  // build-time public var for local dev (`next dev` reads .env.local).
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBase) {
    return NextResponse.json({ waitlistActive: false })
  }

  try {
    const res = await fetch(`${apiBase}/waitlist/status`)
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json({ waitlistActive: false })
  }
}
