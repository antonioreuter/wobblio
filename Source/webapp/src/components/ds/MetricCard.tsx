import type { CSSProperties, ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

export interface MetricCardProps {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  tone?: Tone
  style?: CSSProperties
  className?: string
}

const TONE_COLORS: Record<Tone, string> = {
  neutral: 'var(--text-secondary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

export function MetricCard({ label, value, delta, tone = 'neutral', style, className }: MetricCardProps) {
  return (
    <div className={`glass ${className ?? ''}`.trim()} style={{ padding: 'var(--space-5)', ...style }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-wide)',
          color: 'var(--text-muted)',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: delta ? '4px' : 0,
        }}
      >
        {value}
      </div>
      {delta && <div style={{ fontSize: '13px', color: TONE_COLORS[tone] }}>{delta}</div>}
    </div>
  )
}
