import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds translateY lift + brand glow on hover. @default false */
  interactive?: boolean;
  children?: React.ReactNode;
}

/**
 * Frosted-glass surface — the base container for nearly every Wobblio panel.
 * @dsCard group="Components"
 * @startingPoint section="Core" subtitle="Glass surface card" viewport="700x240"
 */
export function Card(props: CardProps): JSX.Element;
