import React from 'react';

/**
 * Square checkbox with brand fill + check glyph. Pairs with a label.
 */
export function Checkbox({ checked, defaultChecked, onChange, label, id, disabled = false, ...rest }) {
  const isOn = checked ?? defaultChecked;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        style={{ display: 'none' }}
        {...rest}
      />
      <span
        style={{
          width: '20px', height: '20px', borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isOn ? 'var(--brand)' : 'var(--glass-border)'}`,
          background: isOn ? 'var(--brand)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0,
          transition: 'all var(--transition-fast)',
        }}
      >
        {isOn ? '✓' : ''}
      </span>
      {label && <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
}
