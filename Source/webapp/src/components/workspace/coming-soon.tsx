import { Construction } from 'lucide-react'

interface ComingSoonProps {
  page: string
}

export function ComingSoon({ page }: ComingSoonProps) {
  return (
    <div className="pane" data-testid="coming-soon">
      <p className="pane-subtitle">This view will land once the backend wires in.</p>
      <div className="glass" style={{ padding: 48, textAlign: 'center', marginTop: 24 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand)',
            background: 'var(--brand-glow)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <Construction size={26} />
        </div>
        <h3 style={{ fontSize: 18, marginBottom: 6, color: 'var(--text-primary)' }}>
          {page} is coming soon
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto' }}>
          We&apos;re prototyping the design first. Once the backend ingestion and household data are
          wired up, this section will light up automatically.
        </p>
      </div>
    </div>
  )
}
