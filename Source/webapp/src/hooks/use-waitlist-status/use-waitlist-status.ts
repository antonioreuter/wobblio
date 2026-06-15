import { useState, useEffect } from 'react'

export function useWaitlistStatus() {
  const [waitlistActive, setWaitlistActive] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Same-origin BFF route — resolves the backend base URL server-side at
    // runtime, so the localhost value never leaks into the client bundle.
    fetch('/api/waitlist/status')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setWaitlistActive(Boolean(data.waitlistActive))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setWaitlistActive(false)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { waitlistActive, loading }
}
