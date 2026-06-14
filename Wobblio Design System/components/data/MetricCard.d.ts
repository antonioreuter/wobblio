import * as React from 'react';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Uppercase overline (e.g. "Total Tracked Spend") */
  label: string;
  /** Large display value (e.g. "€642.30") */
  value: React.ReactNode;
  /** Optional delta line under the value */
  delta?: React.ReactNode;
  /** Color of the delta line. @default "neutral" */
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

/**
 * KPI tile for the workspace dashboard. Value uses the Outfit display face + tabular numerals.
 * @dsCard group="Components"
 * @startingPoint section="Data" subtitle="KPI metric tile" viewport="700x180"
 */
export function MetricCard(props: MetricCardProps): JSX.Element;
