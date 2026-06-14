import { useState, useEffect } from 'react'

export function useWaitlistStatus() {
  const [waitlistActive, setWaitlistActive] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!base) {
      setWaitlistActive(false)
      setLoading(false)
      return
    }

    let cancelled = false
    fetch(`${base}/waitlist/status`)
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
