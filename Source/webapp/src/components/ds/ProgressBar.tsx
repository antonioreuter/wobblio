import type { CSSProperties } from 'react'

type Tone = 'success' | 'warning' | 'danger'

export interface ProgressBarProps {
  value?: number
  tone?: Tone
  showThreshold?: boolean
  style?: CSSProperties
  className?: string
}

const FILL: Record<Tone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

export function ProgressBar({ value = 0, tone, showThreshold = true, style, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  const auto: Tone = pct >= 85 ? 'danger' : pct >= 75 ? 'warning' : 'success'
  const fill = FILL[tone ?? auto]

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '8px',
        background: 'var(--glass-border)',
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: fill,
          borderRadius: 'var(--radius-pill)',
          transition: 'width 0.8s var(--ease-out)',
        }}
      />
      {showThreshold && (
        <span
          style={{
            position: 'absolute',
            left: '85%',
            top: 0,
            bottom: 0,
            width: '1.5px',
            background: 'rgba(255,255,255,0.3)',
            zIndex: 2,
          }}
        />
      )}
    </div>
  )
}
