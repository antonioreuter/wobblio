import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SiteHeader } from '@/components/ui/site-header'
import { SiteFooter } from '@/components/ui/site-footer'

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <>
      <SiteHeader variant="landing" />
      <main className="legal-page">
        <h1 className="legal-title">{title}</h1>
        <p className="legal-meta">Last updated {lastUpdated}</p>
        <div className="legal-draft" role="note">
          <AlertTriangle size={16} />
          <span>
            Draft placeholder — this content is pending legal review and is not the final
            policy.
          </span>
        </div>
        <div className="legal-body">{children}</div>
      </main>
      <SiteFooter />
    </>
  )
}
