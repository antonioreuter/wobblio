import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'GDPR — Wobblio',
  description: 'How Wobblio complies with the EU General Data Protection Regulation.',
}

export default function GdprPage() {
  return (
    <LegalPage title="GDPR Compliance" lastUpdated="June 2026">
      <h2>Data minimization</h2>
      <p>
        Wobblio stores only what each feature needs. Sensitive free-text (notes, contact names,
        invite tokens, export URLs) is encrypted; amounts, merchants, products, and dates are
        not, so they remain queryable without weakening their protection.
      </p>
      <h2>Right to access and portability (Art. 15 &amp; 20)</h2>
      <p>One-tap export delivers your data in a portable format.</p>
      <h2>Right to erasure (Art. 17)</h2>
      <p>
        Account deletion triggers a soft-lock followed by a 30-day hard purge of personal data
        and your private receipt images. Anonymized price observations, which contain no personal
        data, are retained to keep the regional price index intact.
      </p>
      <h2>Data residency</h2>
      <p>All personal data is hosted within the EU.</p>
    </LegalPage>
  )
}
