import * as React from 'react';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Percent filled, 0–100 */
  value: number;
  /** Force a fill color; omit to auto-color (≥85 danger, ≥75 warning, else success) */
  tone?: 'success' | 'warning' | 'danger';
  /** Render the 85% over-budget threshold tick. @default true */
  showThreshold?: boolean;
}

/**
 * Category-budget meter. Auto-reddens as spend approaches the 85% threshold marker.
 * @dsCard group="Components"
 */
export function ProgressBar(props: ProgressBarProps): JSX.Element;
