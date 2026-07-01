import type { HTMLAttributes } from 'react'

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  initials?: string
  size?: number
  /** Flat CSS color override, e.g. for per-participant color coding. Falls back to the brand gradient. */
  background?: string
}

export function Avatar({ initials = '', size = 36, background, style, ...rest }: AvatarProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: background ?? 'var(--gradient-avatar)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size * 0.36,
        color: '#fff',
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      {initials}
    </span>
  )
}
