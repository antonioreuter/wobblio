'use client';

type FunnelEvent = 'hero_cta_click' | 'pricing_view' | 'signup_start' | 'signup_complete' | 'waitlist_join';

export function useAnalytics() {
  function track(event: FunnelEvent) {
    // Same-origin BFF route — resolves the backend base URL server-side at
    // runtime, so the localhost value never leaks into the client bundle.
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    }).catch(() => {});
  }

  return { track };
}
