import React from 'react';

/**
 * Wobblio primary action button. Maps to the `.btn` system in base.css.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  style,
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'lg' ? 'btn--lg' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick} style={style} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
