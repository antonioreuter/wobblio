import * as React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Up to 2 initials shown in the circle */
  initials?: string;
  /** Diameter in px. @default 36 */
  size?: number;
}

/**
 * Indigo-gradient circular avatar with initials (top-bar profile, household members).
 * @dsCard group="Components"
 */
export function Avatar(props: AvatarProps): JSX.Element;
