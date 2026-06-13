import * as React from 'react';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Show a × remove affordance. @default false */
  removable?: boolean;
  /** Called when the remove × is clicked */
  onRemove?: () => void;
  children?: React.ReactNode;
}

/**
 * Low-emphasis metadata tag for categorizing invoices and items.
 * @dsCard group="Components"
 */
export function Tag(props: TagProps): JSX.Element;
