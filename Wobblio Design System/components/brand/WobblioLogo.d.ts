import * as React from 'react';

export interface WobblioLogoProps extends React.SVGAttributes<SVGElement> {
  /** Mark width in px (height scales 2:3). @default 32 */
  size?: number;
  /** Render the "wobblio" wordmark beside the mark. @default false */
  withWordmark?: boolean;
  style?: React.CSSProperties;
}

/**
 * Wobblio brand logo — double-loop crossover wave ("outsmarting inflation").
 * @dsCard group="Components"
 * @startingPoint section="Brand" subtitle="Logo mark + wordmark" viewport="700x160"
 */
export function WobblioLogo(props: WobblioLogoProps): JSX.Element;
