import { describe, it, expect } from 'vitest';
import {
  buildPriceObservations,
  type ObservationBuildInput,
  type ObservationLine,
  type ContributorContext,
} from '@core/domain/priceObservation';

const context = (overrides: Partial<ContributorContext> = {}): ContributorContext => ({
  optedOut: false,
  regionCode: 'NL-NB',
  countryCode: 'NL',
  trustScore: 50,
  ...overrides,
});

const line = (overrides: Partial<ObservationLine> = {}): ObservationLine => ({
  productId: 'prod-1',
  productProvisional: false,
  baseUnit: 'KG',
  normalizedUnitPrice: 3,
  isDepositOrFee: false,
  quantity: 2,
  lineTotal: 3,
  listUnitPrice: null,
  ...overrides,
});

const input = (overrides: Partial<ObservationBuildInput> = {}): ObservationBuildInput => ({
  merchantId: 'merch-1',
  merchantProvisional: false,
  transactionDate: '2026-06-10',
  currency: 'eur',
  lines: [line()],
  context: context(),
  ...overrides,
});

describe('buildPriceObservations', () => {
  it('emits a de-identified row for an eligible line', () => {
    const [row] = buildPriceObservations(input());
    expect(row).toEqual({
      productId: 'prod-1',
      merchantId: 'merch-1',
      countryCode: 'NL',
      regionCode: 'NL-NB',
      observedOn: '2026-06-10',
      packPrice: 1.5,
      normalizedUnitPrice: 3,
      baseUnit: 'KG',
      currency: 'EUR',
      wasDiscounted: false,
      quality: 'AUTO',
      quarantined: false,
      contributorTrustAtWrite: 50,
    });
  });

  it('marks observations USER_CONFIRMED when the invoice was user-corrected', () => {
    const [auto] = buildPriceObservations(input());
    expect(auto.quality).toBe('AUTO');
    const [corrected] = buildPriceObservations(input({ userCorrected: true }));
    expect(corrected.quality).toBe('USER_CONFIRMED');
  });

  it('emits nothing when the contributor opted out', () => {
    expect(buildPriceObservations(input({ context: context({ optedOut: true }) }))).toEqual([]);
  });

  it('emits nothing when there is no merchant', () => {
    expect(buildPriceObservations(input({ merchantId: null }))).toEqual([]);
  });

  it('quarantines when the merchant is provisional', () => {
    const [row] = buildPriceObservations(input({ merchantProvisional: true }));
    expect(row.quarantined).toBe(true);
  });

  it('quarantines when the product is provisional', () => {
    const [row] = buildPriceObservations(input({ lines: [line({ productProvisional: true })] }));
    expect(row.quarantined).toBe(true);
  });

  it('falls back to the country code when the contributor has no region', () => {
    const [row] = buildPriceObservations(input({ context: context({ regionCode: null }) }));
    expect(row.regionCode).toBe('NL');
  });

  it('rounds the contributor trust score', () => {
    const [row] = buildPriceObservations(input({ context: context({ trustScore: 49.6 }) }));
    expect(row.contributorTrustAtWrite).toBe(50);
  });

  it('marks a line discounted when the paid pack price is below the listed unit price', () => {
    // packPrice = lineTotal / quantity = 4 / 2 = 2.0, below the listed 2.5.
    const [row] = buildPriceObservations(input({ lines: [line({ quantity: 2, lineTotal: 4, listUnitPrice: 2.5 })] }));
    expect(row.wasDiscounted).toBe(true);
  });

  it('does not mark a line discounted when the paid price matches the listed unit price', () => {
    const [row] = buildPriceObservations(input({ lines: [line({ quantity: 2, lineTotal: 5, listUnitPrice: 2.5 })] }));
    expect(row.wasDiscounted).toBe(false);
  });

  it('skips deposit/fee, unmatched, and non-positive lines', () => {
    const result = buildPriceObservations(
      input({
        lines: [
          line({ isDepositOrFee: true }),
          line({ productId: null }),
          line({ quantity: 0 }),
          line({ lineTotal: -1 }),
        ],
      }),
    );
    expect(result).toEqual([]);
  });

  it('emits on pack price when the pack size is unknown, with null per-unit fields', () => {
    const result = buildPriceObservations(
      input({ lines: [line({ baseUnit: null, normalizedUnitPrice: null, quantity: 2, lineTotal: 3 })] }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ packPrice: 1.5, normalizedUnitPrice: null, baseUnit: null });
  });
});
