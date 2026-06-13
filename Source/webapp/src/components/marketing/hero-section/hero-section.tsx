'use client';

import { useAnalytics } from '@/hooks/use-analytics/use-analytics';

const SIGNUP_URL = process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL ?? '/auth/signup';
const SIGNIN_URL = process.env.NEXT_PUBLIC_COGNITO_SIGNIN_URL ?? '/auth/signin';

interface HeroSectionProps {
  waitlistActive: boolean | null;
}

export function HeroSection({ waitlistActive }: HeroSectionProps) {
  const { track } = useAnalytics();

  if (waitlistActive === null) {
    return <div data-testid="hero-cta-loading" role="status" aria-busy="true" />;
  }

  return (
    <section data-testid="hero-section" className="relative overflow-hidden py-20 text-center">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] sm:text-5xl">
          Scan your receipts.<br />Outsmart inflation.
        </h1>
        <p className="mb-8 text-lg text-[#64748b] dark:text-[#94a3b8]">
          Wobblio reads any receipt worldwide with AI — automatic expense breakdown, real local price comparison, and shopping lists that locate the cheapest store. No bank connection required. Ever.
        </p>

        {waitlistActive ? (
          <div>
            <p className="mb-4 text-sm text-[#64748b] dark:text-[#94a3b8]">
              2,140 people ahead of you — or skip the line with Premium
            </p>
            <a
              href={`${SIGNUP_URL}?waitlist=true`}
              onClick={() => track('waitlist_join')}
              className="inline-flex h-12 items-center rounded-lg bg-[#0d9488] px-6 text-base font-medium text-white hover:bg-[#0f766e]"
              data-testid="hero-cta-primary"
            >
              Join the priority waitlist
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={SIGNUP_URL}
              onClick={() => track('hero_cta_click')}
              className="inline-flex h-12 items-center rounded-lg bg-[#0d9488] px-6 text-base font-medium text-white hover:bg-[#0f766e]"
              data-testid="hero-cta-primary"
            >
              Start free
            </a>
            <a
              href={SIGNIN_URL}
              className="inline-flex h-12 items-center rounded-lg border border-[#e2e8f0] bg-white px-6 text-base font-medium text-[#0f172a] hover:bg-[#f8fafc] dark:border-[#334155] dark:bg-[#111827] dark:text-[#f1f5f9]"
              data-testid="hero-cta-secondary"
            >
              Sign in
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
