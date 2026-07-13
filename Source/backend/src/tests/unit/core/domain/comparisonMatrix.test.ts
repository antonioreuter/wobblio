import { describe, it, expect } from 'vitest';
import { buildComparisonMatrix, type RawCell, type ComparisonLink } from '@core/domain/comparisonMatrix';
import type { OfferSize } from '@core/domain/comparability';

const dense = (price: number, n = 3): number[] => Array.from({ length: n }, () => price);
const cell = (productId: string, merchantId: string, prices: number[]): RawCell => ({
  productId, merchantId, merchantName: `M-${merchantId}`, prices, lastObservedOn: '2026-07-10',
});

const base = {
  ambiguity: { gapPct: 0.4 },
  minObservations: 3,
  userAverages: {},
};

describe('buildComparisonMatrix', () => {
  it('folds a comparable sibling cell into the item row, relabeled to the item productId', () => {
    // Item P at merchant A (1.20); sibling Q at merchant B (1.00), user-confirmed same size.
    const sizes = new Map<string, OfferSize>([
      ['P', { packSize: 2, baseUnit: 'L' }],
      ['Q', { packSize: 2, baseUnit: 'L' }],
    ]);
    const links: ComparisonLink[] = [{ selfId: 'P', otherId: 'Q', sizeEquivalent: true }];
    const { matrix, reasons } = buildComparisonMatrix({
      ...base, requestedProductIds: ['P'], sizes, links,
      rawCells: [cell('P', 'A', dense(1.2)), cell('Q', 'B', dense(1.0))],
    });
    // Q's cell is relabeled to P at merchant B → the optimizer sees P priceable at A and B.
    expect(matrix.cells.map((c) => `${c.productId}@${c.merchantId}=${c.price}`).sort())
      .toEqual(['P@A=1.2', 'P@B=1']);
    expect(matrix.merchants.map((m) => m.id).sort()).toEqual(['A', 'B']);
    expect(reasons.get('P')).toBe('comparable');
  });

  it('never folds a watch-only link (sizes not known-equal, no confirmation)', () => {
    const sizes = new Map<string, OfferSize>([
      ['P', { packSize: 2, baseUnit: 'L' }],
      ['Q', { packSize: null, baseUnit: null }], // size unknown → watch-only
    ]);
    const links: ComparisonLink[] = [{ selfId: 'P', otherId: 'Q', sizeEquivalent: false }];
    const { matrix, reasons } = buildComparisonMatrix({
      ...base, requestedProductIds: ['P'], sizes, links,
      rawCells: [cell('P', 'A', dense(1.2)), cell('Q', 'B', dense(1.0))],
    });
    expect(matrix.cells).toEqual([{ productId: 'P', merchantId: 'A', price: 1.2, observationCount: 3, lastObservedOn: '2026-07-10' }]);
    expect(reasons.get('P')).toBe('watch_only');
  });

  it('excludes an ambiguous sibling cell even when size-confirmed', () => {
    const sizes = new Map<string, OfferSize>([
      ['P', { packSize: 2, baseUnit: 'L' }],
      ['Q', { packSize: 2, baseUnit: 'L' }],
    ]);
    const links: ComparisonLink[] = [{ selfId: 'P', otherId: 'Q', sizeEquivalent: true }];
    // Q's cell is bimodal (0.99 vs 2.49) → ambiguous → never ranked.
    const { matrix, reasons } = buildComparisonMatrix({
      ...base, requestedProductIds: ['P'], sizes, links,
      rawCells: [cell('P', 'A', dense(1.2)), cell('Q', 'B', [0.99, 0.99, 0.99, 2.49, 2.49, 2.49])],
    });
    expect(matrix.cells.map((c) => c.merchantId)).toEqual(['A']);
    expect(reasons.get('P')).toBe('ambiguous');
  });

  it('drops the item’s own cell when it is price-ambiguous (excluded from the crown)', () => {
    const sizes = new Map<string, OfferSize>([['P', { packSize: 2, baseUnit: 'L' }]]);
    const { matrix } = buildComparisonMatrix({
      ...base, requestedProductIds: ['P'], sizes, links: [],
      rawCells: [cell('P', 'A', [0.99, 0.99, 0.99, 2.49, 2.49, 2.49])],
    });
    expect(matrix.cells).toEqual([]);
  });

  it('suppresses a sub-quorum cell (k<3)', () => {
    const sizes = new Map<string, OfferSize>([['P', { packSize: 2, baseUnit: 'L' }]]);
    const { matrix } = buildComparisonMatrix({
      ...base, requestedProductIds: ['P'], sizes, links: [],
      rawCells: [cell('P', 'A', [1.2, 1.2])], // only 2 observations
    });
    expect(matrix.cells).toEqual([]);
  });

  it('reports no_link for an item with no comparison set', () => {
    const sizes = new Map<string, OfferSize>([['P', { packSize: 2, baseUnit: 'L' }]]);
    const { reasons } = buildComparisonMatrix({
      ...base, requestedProductIds: ['P'], sizes, links: [],
      rawCells: [cell('P', 'A', dense(1.2))],
    });
    expect(reasons.get('P')).toBe('no_link');
  });
});
