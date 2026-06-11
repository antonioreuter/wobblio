import { useState, useEffect } from 'react';

export function useWaitlistStatus() {
  const [waitlistActive, setWaitlistActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/waitlist/status')
      .then((res) => res.json())
      .then((data) => {
        setWaitlistActive(data.waitlistActive);
        setLoading(false);
      });
  }, []);

  return { waitlistActive, loading };
}
