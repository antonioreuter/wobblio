import React from 'react';

/**
 * User avatar — gradient circle with initials.
 */
export function Avatar({ initials = '', size = 36, style, ...rest }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--gradient-avatar)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: size * 0.36, color: '#fff', flexShrink: 0, ...style,
      }}
      {...rest}
    >
      {initials}
    </span>
  );
}
