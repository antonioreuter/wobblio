import React from 'react';

/**
 * Dashboard metric tile — overline label, large tabular value, tinted delta.
 */
export function MetricCard({ label, value, delta, tone = 'neutral', style, ...rest }) {
  const toneColor = {
    neutral: 'var(--text-secondary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }[tone];

  return (
    <div className="glass" style={{ padding: 'var(--space-5)', ...style }} {...rest}>
      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-muted)', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', marginBottom: delta ? '4px' : 0 }}>
        {value}
      </div>
      {delta && <div style={{ fontSize: '13px', color: toneColor }}>{delta}</div>}
    </div>
  );
}
