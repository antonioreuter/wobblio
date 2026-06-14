import * as React from 'react';

export interface MerchantIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Store name — matched case-insensitively (startsWith) to a brand config */
  merchant: string;
  /** Square size in px. @default 28 */
  size?: number;
}

/**
 * Brand-colored merchant badge for ledger rows. Known: Albert Heijn, AH To Go,
 * Jumbo, Dirk, Lidl, Tokomania, Restaurante Cantinho. Unknown → neutral receipt glyph.
 * @dsCard group="Components"
 */
export function MerchantIcon(props: MerchantIconProps): JSX.Element;
