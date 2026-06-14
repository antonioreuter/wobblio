import React from 'react';

/**
 * Glassmorphic surface card. Optional `interactive` adds lift on hover.
 */
export function Card({ children, interactive = false, className = '', style, ...rest }) {
  const classes = ['glass', interactive ? 'glass-interactive' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={{ padding: 'var(--space-6)', ...style }} {...rest}>
      {children}
    </div>
  );
}
