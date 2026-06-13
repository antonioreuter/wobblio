import React from 'react';

/**
 * Subtle metadata tag (e.g. "weekly", "dinner") used in table cells.
 */
export function Tag({ children, removable = false, onRemove, style, ...rest }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '11px', fontFamily: 'var(--font-body)',
        background: 'var(--glass-highlight)',
        border: '1px solid var(--glass-border)',
        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)', ...style,
      }}
      {...rest}
    >
      {children}
      {removable && (
        <button
          onClick={onRemove}
          aria-label="Remove tag"
          style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 700, lineHeight: 1 }}
        >×</button>
      )}
    </span>
  );
}
