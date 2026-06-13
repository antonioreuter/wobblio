import { useId, type CSSProperties } from 'react'

export interface WobblioLogoProps {
  size?: number
  withWordmark?: boolean
  style?: CSSProperties
  className?: string
}

export function WobblioLogo({ size = 32, withWordmark = false, style, className }: WobblioLogoProps) {
  const gradId = useId()
  const mark = (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: (size * 32) / 48, display: 'block' }}
      aria-label="Wobblio"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <path
        d="M 6 22 C 10 22, 14 6, 20 6 C 24 6, 26 18, 32 14 L 42 14"
        stroke={`url(#${gradId})`}
        strokeWidth={3.5}
      />
      <path
        d="M 6 22 C 10 22, 15 26, 20 20 C 23 16, 26 12, 30 16 C 33 19, 36 24, 42 24"
        stroke={`url(#${gradId})`}
        strokeWidth={3.5}
      />
    </svg>
  )

  if (!withWordmark) return mark

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', ...style }}
    >
      {mark}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size * 0.62,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          color: 'var(--text-primary)',
        }}
      >
        wobbl<span style={{ color: 'var(--brand)' }}>io</span>
      </span>
    </span>
  )
}
