import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service — Wobblio',
  description: 'The terms governing your use of Wobblio.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 2026">
      <h2>Using Wobblio</h2>
      <p>
        Wobblio is a personal fiscal management tool. You are responsible for the accuracy of the
        receipts you upload and for reviewing the structured data extracted from them.
      </p>
      <h2>Subscriptions</h2>
      <p>
        Premium is sold exclusively through Stripe web checkout. Billing, renewals, and
        cancellations are managed through Stripe&apos;s customer portal.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not upload content you are not authorized to process, and do not attempt to
        de-anonymize the regional price index or other tenants&apos; data.
      </p>
    </LegalPage>
  )
}
