import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Uppercase field label rendered above the input */
  label?: string;
  /** Leading icon node (e.g. a Lucide search glyph) */
  icon?: React.ReactNode;
  /** Low-confidence parse state: amber border + inset bar. @default false */
  flagged?: boolean;
}

/**
 * Single-line text field. Focus ring is the brand glow; `flagged` marks
 * AI-extracted values that need human verification.
 * @dsCard group="Components"
 */
export function Input(props: InputProps): JSX.Element;
