import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'outline' | 'text';
  /** Size. @default "md" */
  size?: 'md' | 'lg';
  /** Optional icon node rendered before the label */
  iconLeft?: React.ReactNode;
  /** Optional icon node rendered after the label */
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Primary call-to-action button for Wobblio.
 * @dsCard group="Components"
 * @startingPoint section="Core" subtitle="Button — primary, outline, text" viewport="700x220"
 */
export function Button(props: ButtonProps): JSX.Element;
