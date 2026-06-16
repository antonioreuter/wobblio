import { resolveObservationRegion } from './region';
import { roundTo, type BaseUnit } from './unitSize';

// Stage 5: build de-identified price observations from enriched lines (§6.5). The
// rows carry NO tenant/user/household/invoice reference and NO tags — only product,
// merchant, coarse region, day-precision date, and price. Provisional catalog
// entries are emitted quarantined until promoted (Layer 1 write-side).

export interface ContributorContext {
  optedOut: boolean;
  regionCode: string | null; // ISO 3166-2, contributor home region
  countryCode: string; // ISO 3166-1 alpha-2
  trustScore: number;
}

export interface ObservationLine {
  productId: string | null;
  productProvisional: boolean;
  baseUnit: BaseUnit | null;
  normalizedUnitPrice: number | null;
  isDepositOrFee: boolean;
  quantity: number;
  lineTotal: number;
  listUnitPrice: number | null; // receipt's listed per-unit price, for discount detection
}

export interface ObservationBuildInput {
  merchantId: string | null;
  merchantProvisional: boolean;
  transactionDate: string; // ISO YYYY-MM-DD
  currency: string;
  lines: ObservationLine[];
  context: ContributorContext;
}

export interface PriceObservationInput {
  productId: string;
  merchantId: string;
  countryCode: string;
  regionCode: string;
  observedOn: string;
  packPrice: number;
  normalizedUnitPrice: number;
  baseUnit: BaseUnit;
  currency: string;
  wasDiscounted: boolean;
  quarantined: boolean;
  contributorTrustAtWrite: number;
}

const DISCOUNT_EPSILON_EUR = 0.005;

// A line was discounted when the per-pack price actually paid is below the receipt's
// listed unit price. With no listed price we cannot tell, so it stays false.
function isDiscounted(line: ObservationLine, packPrice: number): boolean {
  return line.listUnitPrice !== null && packPrice < line.listUnitPrice - DISCOUNT_EPSILON_EUR;
}

function isEmittable(line: ObservationLine): boolean {
  return (
    !line.isDepositOrFee &&
    line.productId !== null &&
    line.baseUnit !== null &&
    line.normalizedUnitPrice !== null &&
    line.normalizedUnitPrice > 0 &&
    line.quantity > 0 &&
    line.lineTotal > 0
  );
}

export function buildPriceObservations(input: ObservationBuildInput): PriceObservationInput[] {
  if (input.context.optedOut || input.merchantId === null) return [];

  const regionCode = resolveObservationRegion(input.context.regionCode, input.context.countryCode);
  const currency = input.currency.toUpperCase();
  const trust = Math.round(input.context.trustScore);

  const rows: PriceObservationInput[] = [];
  for (const line of input.lines) {
    if (!isEmittable(line)) continue;
    const packPrice = roundTo(line.lineTotal / line.quantity, 4);
    rows.push({
      productId: line.productId as string,
      merchantId: input.merchantId,
      countryCode: input.context.countryCode,
      regionCode,
      observedOn: input.transactionDate,
      packPrice,
      normalizedUnitPrice: line.normalizedUnitPrice as number,
      baseUnit: line.baseUnit as BaseUnit,
      currency,
      wasDiscounted: isDiscounted(line, packPrice),
      quarantined: input.merchantProvisional || line.productProvisional,
      contributorTrustAtWrite: trust,
    });
  }
  return rows;
}
