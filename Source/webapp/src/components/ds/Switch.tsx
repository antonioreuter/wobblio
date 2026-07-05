import type { InputHTMLAttributes } from 'react'

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function Switch({ className = '', ...rest }: SwitchProps) {
  return (
    <label className={`ds-switch ${className}`.trim()}>
      <input type="checkbox" role="switch" {...rest} />
      <span className="ds-switch-track" aria-hidden="true" />
      <span className="ds-switch-thumb" aria-hidden="true" />
    </label>
  )
}
