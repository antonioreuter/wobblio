import React from 'react';

/**
 * Budget progress bar. Auto-colors by spend ratio unless `tone` is forced.
 * Renders the 85% over-budget threshold marker.
 */
export function ProgressBar({ value = 0, tone, showThreshold = true, style, ...rest }) {
  const pct = Math.max(0, Math.min(100, value));
  const auto = pct >= 85 ? 'danger' : pct >= 75 ? 'warning' : 'success';
  const fillColor = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }[tone || auto];

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '8px', background: 'var(--glass-border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', ...style }}
      {...rest}
    >
      <div style={{ height: '100%', width: `${pct}%`, background: fillColor, borderRadius: 'var(--radius-pill)', transition: 'width 0.8s var(--ease-out)' }} />
      {showThreshold && (
        <span style={{ position: 'absolute', left: '85%', top: 0, bottom: 0, width: '1.5px', background: 'rgba(255,255,255,0.3)', zIndex: 2 }} />
      )}
    </div>
  );
}
