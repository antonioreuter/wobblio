import React from 'react';

/**
 * Text field with optional label, leading icon, and low-confidence "flagged" state.
 */
export function Input({ label, icon, flagged = false, id, style, ...rest }) {
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '12px', fontWeight: 600, letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px',
            color: flagged ? 'var(--warning)' : 'var(--text-muted)',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '14px', display: 'flex', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            {icon}
          </span>
        )}
        <input
          id={inputId}
          style={{
            width: '100%', height: 'var(--control-height)', borderRadius: 'var(--radius-md)',
            border: `1px solid ${flagged ? 'var(--warning)' : 'var(--glass-border)'}`,
            background: flagged ? 'rgba(245,158,11,0.04)' : 'var(--glass-highlight)',
            boxShadow: flagged ? 'inset 4px 0 0 var(--warning)' : 'none',
            color: 'var(--text-primary)', padding: icon ? '0 14px 0 42px' : '0 14px',
            fontFamily: 'var(--font-body)', fontSize: '14px', outline: 'none',
            transition: 'all var(--transition-fast)', ...style,
          }}
          onFocus={(e) => { if (!flagged) { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-glow)'; } }}
          onBlur={(e) => { if (!flagged) { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none'; } }}
          {...rest}
        />
      </div>
    </div>
  );
}
