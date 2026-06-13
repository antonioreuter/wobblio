import type { Metadata } from 'next';
import { LandingPageView } from '@/components/marketing/landing-page-view';

export const metadata: Metadata = {
  title: 'Wobblio — Scan receipts. Outsmart inflation.',
  description:
    'Wobblio reads any receipt worldwide with AI — automatic expense breakdown, real local price comparison, and shopping lists that locate the cheapest store. No bank connection required. Ever.',
  openGraph: {
    title: 'Wobblio — Scan receipts. Outsmart inflation.',
    description:
      'Wobblio reads any receipt worldwide with AI — automatic expense breakdown, real local price comparison, and shopping lists that locate the cheapest store. No bank connection required. Ever.',
    type: 'website',
    locale: 'en_NL',
    siteName: 'Wobblio',
  },
};

export default function LandingPage() {
  return <LandingPageView />;
}
