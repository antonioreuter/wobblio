import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone. @default "primary" */
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  children?: React.ReactNode;
}

/**
 * Small uppercase status pill (e.g. Processed / Needs Review / Auto Parsed).
 * @dsCard group="Components"
 */
export function Badge(props: BadgeProps): JSX.Element;
