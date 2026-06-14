import * as React from 'react';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Optional text label rendered to the right */
  label?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Square checkbox with indigo fill — shopping-list items, retailer filters.
 * @dsCard group="Components"
 */
export function Checkbox(props: CheckboxProps): JSX.Element;
