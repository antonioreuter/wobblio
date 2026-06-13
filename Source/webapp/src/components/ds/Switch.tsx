import type { InputHTMLAttributes } from 'react'

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function Switch({ checked, defaultChecked, onChange, disabled = false, id, ...rest }: SwitchProps) {
  const isOn = checked ?? defaultChecked
  return (
    <label
      style={{
        display: 'inline-block',
        position: 'relative',
        width: '46px',
        height: '24px',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        {...rest}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: isOn ? 'var(--success)' : 'var(--text-muted)',
          borderRadius: '34px',
          transition: '0.3s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            height: '18px',
            width: '18px',
            left: '3px',
            bottom: '3px',
            background: '#fff',
            borderRadius: '50%',
            transition: '0.3s',
            transform: isOn ? 'translateX(22px)' : 'none',
          }}
        />
      </span>
    </label>
  )
}
