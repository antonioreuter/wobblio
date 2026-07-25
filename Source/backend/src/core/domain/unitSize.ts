// Parse free-text unit sizes off receipt lines into a canonical base unit + pack
// size. This is descriptive/identity metadata only — no per-unit price is ever
// derived from it (fix 09/01: receipt-verbatim pricing). Unparseable sizes return null.

export type BaseUnit = 'KG' | 'L' | 'PIECE';

// Evidence state for a line's / series' pack size (fix 09/01). RECEIPT: a size token was
// printed on the receipt line and transcribed verbatim. USER: the shopper set it via the
// review-screen "Set size" affordance. null (absent): size is unknown — never inferred.
export type SizeSource = 'RECEIPT' | 'USER';

export interface ParsedUnitSize {
  packQuantity: number; // pack size expressed in base units (e.g. 0.5 for 500g)
  baseUnit: BaseUnit;
}

interface UnitFactor {
  baseUnit: BaseUnit;
  toBase: number; // multiply the raw amount by this to get base units
}

const UNIT_FACTORS: Record<string, UnitFactor> = {
  KG: { baseUnit: 'KG', toBase: 1 },
  G: { baseUnit: 'KG', toBase: 0.001 },
  GRAM: { baseUnit: 'KG', toBase: 0.001 },
  L: { baseUnit: 'L', toBase: 1 },
  LTR: { baseUnit: 'L', toBase: 1 },
  LITER: { baseUnit: 'L', toBase: 1 },
  ML: { baseUnit: 'L', toBase: 0.001 },
  CL: { baseUnit: 'L', toBase: 0.01 },
  DL: { baseUnit: 'L', toBase: 0.1 },
  ST: { baseUnit: 'PIECE', toBase: 1 },
  STUK: { baseUnit: 'PIECE', toBase: 1 },
  STUKS: { baseUnit: 'PIECE', toBase: 1 },
  PC: { baseUnit: 'PIECE', toBase: 1 },
  PCS: { baseUnit: 'PIECE', toBase: 1 },
  PIECE: { baseUnit: 'PIECE', toBase: 1 },
  PIECES: { baseUnit: 'PIECE', toBase: 1 },
};

const SINGLE_RE = /^(\d+(?:[.,]\d+)?)\s*([A-Z]+)$/;

function parseSingle(token: string): ParsedUnitSize | null {
  const match = token.match(SINGLE_RE);
  if (!match) return null;
  const factor = UNIT_FACTORS[match[2]];
  if (!factor) return null;
  const amount = parseFloat(match[1].replace(',', '.'));
  if (amount <= 0) return null;
  return { packQuantity: amount * factor.toBase, baseUnit: factor.baseUnit };
}

export function parseUnitSize(raw: string | null | undefined): ParsedUnitSize | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/\s+/g, '');
  const multi = cleaned.match(/^(\d+)X(.+)$/);
  if (multi) {
    const count = parseInt(multi[1], 10);
    const single = parseSingle(multi[2]);
    if (count <= 0 || !single) return null;
    return { packQuantity: roundTo(count * single.packQuantity, 4), baseUnit: single.baseUnit };
  }
  return parseSingle(cleaned);
}

// Render a pack size back to a human size chip ("2L", "500g", "3pc") for the descriptive
// size chip in trends / shopping lists (fix 09/01). Sub-unit weights/volumes show in the
// smaller unit so "0.5 KG" reads as "500g". null pack size → null (no chip). Pure display.
export function formatSizeText(packQuantity: number | null, baseUnit: BaseUnit | null): string | null {
  if (packQuantity === null || packQuantity <= 0 || baseUnit === null) return null;
  if (baseUnit === 'KG') {
    return packQuantity < 1 ? `${roundTo(packQuantity * 1000, 0)}g` : `${trimNum(packQuantity)}kg`;
  }
  if (baseUnit === 'L') {
    return packQuantity < 1 ? `${roundTo(packQuantity * 1000, 0)}ml` : `${trimNum(packQuantity)}L`;
  }
  return `${trimNum(packQuantity)}pc`;
}

function trimNum(value: number): string {
  return `${roundTo(value, 3)}`;
}

// Descriptive size for a market/catalog series or linked product (fix 09/01): a chip like
// "2L". A catalog size has no per-line evidence, so a known size is labeled RECEIPT (catalog sizes
// are receipt-transcribed under prompt v5) and an absent size carries none. Own-history derives its
// own USER-vs-RECEIPT source from the tenant's lines and does NOT use this. One place for the rule
// so the trend chip and the linked-product chip never disagree.
export function catalogSize(
  packQuantity: number | null,
  baseUnit: BaseUnit | null,
): { sizeText: string | null; sizeSource: SizeSource | null } {
  const sizeText = formatSizeText(packQuantity, baseUnit);
  return { sizeText, sizeSource: sizeText === null ? null : 'RECEIPT' };
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
