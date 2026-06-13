import React from 'react';

const ICONS = {
  'shopping-bag': 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
  'shopping-cart': 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6 M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  'tag': 'M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82ZM7 7h.01',
  'coins': 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M16.71 13.88A6 6 0 1 1 9 19',
  'coffee': 'M17 8h1a4 4 0 1 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 1v3M10 1v3M14 1v3',
  'flame': 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  'utensils-crossed': 'm16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8 M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7M2.1 21.8 6.4 17.5M19 5l-7 7',
  'receipt': 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z M16 8h-6M16 12h-6',
};

const MERCHANTS = {
  'albert heijn': { color: 'var(--merchant-ah)', fg: '#fff', icon: 'shopping-bag', initials: 'AH' },
  'ah to go': { color: 'var(--merchant-ah)', fg: '#fff', icon: 'coffee', initials: 'AH' },
  'jumbo': { color: 'var(--merchant-jumbo)', fg: '#0f172a', icon: 'shopping-cart', initials: 'J' },
  'dirk': { color: 'var(--merchant-dirk)', fg: '#fff', icon: 'tag', initials: 'D' },
  'lidl': { color: 'var(--merchant-lidl)', fg: '#fff', icon: 'coins', initials: 'L' },
  'tokomania': { color: 'var(--merchant-tokomania)', fg: '#fff', icon: 'flame', initials: 'TK' },
  'restaurante cantinho': { color: 'var(--merchant-cantinho)', fg: '#fff', icon: 'utensils-crossed', initials: 'RC' },
};

/**
 * Colored merchant badge — maps a store name to its brand color + Lucide glyph.
 */
export function MerchantIcon({ merchant = '', size = 28, style, ...rest }) {
  const norm = merchant.toLowerCase().trim();
  const key = Object.keys(MERCHANTS).find((k) => norm.startsWith(k));
  const cfg = key ? MERCHANTS[key] : { color: 'var(--text-muted)', fg: '#fff', icon: 'receipt', initials: '?' };
  return (
    <span
      title={merchant}
      style={{
        width: size, height: size, borderRadius: 'var(--radius-md)',
        background: cfg.color, color: cfg.fg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, ...style,
      }}
      {...rest}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: '55%', height: '55%' }}>
        <path d={ICONS[cfg.icon]} />
      </svg>
    </span>
  );
}
