import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy — Wobblio',
  description: 'How Wobblio collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 2026">
      <h2>What we collect</h2>
      <p>
        Wobblio processes the receipts you upload to extract structured financial data. We never
        connect to your bank. Account data is isolated per tenant with database row-level
        security and hosted in the EU.
      </p>
      <h2>Anonymized price contributions</h2>
      <p>
        With your consent, de-identified price points (product, store, region, date) are
        contributed to the regional price index. These observations carry no link to you, your
        account, or your full basket.
      </p>
      <h2>Your rights</h2>
      <p>
        You can export or delete everything at any time. Account deletion follows a two-phase
        soft-lock and 30-day hard purge; anonymized price observations survive de-identification.
      </p>
    </LegalPage>
  )
}
