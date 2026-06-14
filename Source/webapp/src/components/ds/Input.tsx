'use client'

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label?: string
  icon?: ReactNode
  flagged?: boolean
}

export function Input({ label, icon, flagged = false, id, style, onFocus, onBlur, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id || `in-${autoId}`
  const [focused, setFocused] = useState(false)

  const borderColor = flagged
    ? 'var(--warning)'
    : focused
      ? 'var(--brand)'
      : 'var(--glass-border)'
  const boxShadow = flagged
    ? 'inset 4px 0 0 var(--warning)'
    : focused
      ? '0 0 0 3px var(--brand-glow)'
      : 'none'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: flagged ? 'var(--warning)' : 'var(--text-muted)',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: '14px',
              display: 'flex',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          style={{
            width: '100%',
            height: 'var(--control-height)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${borderColor}`,
            background: flagged ? 'rgba(245,158,11,0.04)' : 'var(--glass-highlight)',
            boxShadow,
            color: 'var(--text-primary)',
            padding: icon ? '0 14px 0 42px' : '0 14px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            outline: 'none',
            transition: 'all var(--transition-fast)',
            ...style,
          }}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          {...rest}
        />
      </div>
    </div>
  )
}
