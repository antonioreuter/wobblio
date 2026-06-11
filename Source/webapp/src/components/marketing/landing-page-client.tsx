'use client';

import { useWaitlistStatus } from '@/hooks/use-waitlist-status/use-waitlist-status';
import { HeroSection } from '@/components/marketing/hero-section/hero-section';

export function LandingPageClient() {
  const { waitlistActive } = useWaitlistStatus();
  return <HeroSection waitlistActive={waitlistActive} />;
}
