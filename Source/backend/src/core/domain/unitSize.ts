// Parse free-text unit sizes off receipt lines into a canonical base unit + pack
// size, and compute the comparable normalized unit price. Unparseable sizes return
// null — the line then yields no price observation (§6.3).

export type BaseUnit = 'KG' | 'L' | 'PIECE';

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

// normalized_unit_price = line_total ÷ quantity ÷ pack_size_base_units (§6.3).
export function computeNormalizedUnitPrice(
  lineTotal: number,
  quantity: number,
  packQuantity: number | null,
): number | null {
  if (packQuantity === null || packQuantity <= 0) return null;
  if (quantity <= 0) return null;
  if (lineTotal <= 0) return null;
  return roundTo(lineTotal / quantity / packQuantity, 4);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
