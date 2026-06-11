'use client';

import { useWaitlistStatus } from '@/hooks/use-waitlist-status/use-waitlist-status';
import { HeroSection } from '@/components/marketing/hero-section/hero-section';

interface LandingPageClientProps {
  ctaOnly?: boolean;
}

export function LandingPageClient({ ctaOnly = false }: LandingPageClientProps) {
  const { waitlistActive } = useWaitlistStatus();

  if (ctaOnly) {
    return <HeroSection waitlistActive={waitlistActive} />;
  }

  return <HeroSection waitlistActive={waitlistActive} />;
}
