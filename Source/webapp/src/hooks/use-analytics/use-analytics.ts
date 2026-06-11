'use client';

type FunnelEvent = 'hero_cta_click' | 'pricing_view' | 'signup_start' | 'signup_complete' | 'waitlist_join';

export function useAnalytics() {
  function track(event: FunnelEvent) {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    }).catch(() => {});
  }

  return { track };
}
