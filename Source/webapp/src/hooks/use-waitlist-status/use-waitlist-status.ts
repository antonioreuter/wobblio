import { useState, useEffect } from 'react';

export function useWaitlistStatus() {
  const [waitlistActive, setWaitlistActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/waitlist/status`)
      .then((res) => res.json())
      .then((data) => {
        setWaitlistActive(data.waitlistActive);
        setLoading(false);
      });
  }, []);

  return { waitlistActive, loading };
}
