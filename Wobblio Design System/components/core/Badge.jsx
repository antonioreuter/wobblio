import React from 'react';

/**
 * Status pill. Uppercase, tracked, tinted by tone.
 */
export function Badge({ children, tone = 'primary', className = '', style, ...rest }) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()} style={style} {...rest}>
      {children}
    </span>
  );
}
