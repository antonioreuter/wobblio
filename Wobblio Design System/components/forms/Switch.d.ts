import * as React from 'react';

export interface SwitchProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Uncontrolled initial state */
  defaultChecked?: boolean;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id?: string;
}

/**
 * Binary toggle (settings, GDPR opt-outs). On = Aurora Teal.
 * @dsCard group="Components"
 */
export function Switch(props: SwitchProps): JSX.Element;
