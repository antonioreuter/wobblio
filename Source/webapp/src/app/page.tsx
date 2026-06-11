import type { Metadata } from 'next';
import { TrustStrip } from '@/components/marketing/trust-strip/trust-strip';
import { HowItWorks } from '@/components/marketing/how-it-works/how-it-works';
import { PersonaGrid } from '@/components/marketing/persona-grid/persona-grid';
import { PriceEngineShowcase } from '@/components/marketing/price-engine-showcase/price-engine-showcase';
import { PricingTable } from '@/components/marketing/pricing-table/pricing-table';
import { FaqSection } from '@/components/marketing/faq-section/faq-section';
import { FooterSection } from '@/components/marketing/footer-section/footer-section';
import { LandingPageClient } from '@/components/marketing/landing-page-client';

export const metadata: Metadata = {
  title: 'Wobblio — Scan your receipts. Outsmart inflation.',
  description:
    'Wobblio reads any receipt with AI — automatic expense tracking, real local price comparison, and shopping lists that know the cheapest store. No bank access. Ever.',
  openGraph: {
    title: 'Wobblio — Scan your receipts. Outsmart inflation.',
    description:
      'AI-powered receipt scanning, local price comparison, and smart shopping lists. No bank connection required.',
    type: 'website',
    locale: 'en_NL',
    siteName: 'Wobblio',
  },
};

export default function LandingPage() {
  return (
    <main>
      <LandingPageClient />
      <TrustStrip />
      <HowItWorks />
      <PersonaGrid />
      <PriceEngineShowcase />
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-semibold">Simple, honest pricing</h2>
          <PricingTable />
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-8 text-center text-2xl font-semibold">Frequently asked questions</h2>
          <FaqSection />
        </div>
      </section>
      <div className="border-t border-[#e2e8f0] py-12 text-center dark:border-[#1e293b]">
        <h2 className="mb-6 text-2xl font-semibold">Ready to outsmart inflation?</h2>
        <LandingPageClient />
      </div>
      <FooterSection />
    </main>
  );
}
