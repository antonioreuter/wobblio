import { describe, it, expect } from 'vitest';
import {
  optimizeRoute,
  type PriceCell,
  type PriceMatrix,
  type OptimizerConfig,
} from '@core/domain/routeOptimizer';

const A = { id: 'A', name: 'Albert Heijn' };
const B = { id: 'B', name: 'Jumbo' };
const C = { id: 'C', name: 'Lidl' };

const cell = (productId: string, merchantId: string, price: number, obs = 8, on = '2026-06-10'): PriceCell => ({
  productId, merchantId, price, observationCount: obs, lastObservedOn: on,
});

const cfg = (minSplitSaving: number, maxStores = 3): OptimizerConfig => ({ minSplitSaving, maxStores });
const item = (productId: string, displayName = productId) => ({ productId, displayName });
const TODAY = '2026-06-16';

const run = (matrix: PriceMatrix, items: { productId: string; displayName: string }[], config: OptimizerConfig, unresolved: string[] = []) =>
  optimizeRoute({ items, unresolved, matrix, config, today: TODAY });

describe('optimizeRoute', () => {
  it('returns an empty result when the region has no candidate merchants', () => {
    const result = run({ merchants: [], cells: [], userAverages: {} }, [item('p1', 'Milk')], cfg(5), ['eggs']);

    expect(result.optimized).toBe(false);
    expect(result.baseline).toBeNull();
    expect(result.stores).toEqual([]);
    expect(result.unresolvedItems).toEqual(['eggs', 'Milk']);
    expect(result.reason).toBe('insufficient regional price data');
  });

  it('returns an empty result when no item is priceable', () => {
    const matrix: PriceMatrix = { merchants: [A], cells: [cell('other', 'A', 3)], userAverages: {} };
    const result = run(matrix, [item('p1', 'Milk')], cfg(5));
    expect(result.stores).toEqual([]);
    expect(result.unresolvedItems).toEqual(['Milk']);
  });

  it('returns a single best store when the saving is below the split threshold', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B],
      cells: [
        cell('p1', 'A', 2), cell('p1', 'B', 5),
        cell('p2', 'A', 2), cell('p2', 'B', 5),
        cell('p3', 'A', 5), cell('p3', 'B', 2),
        cell('p4', 'A', 5), cell('p4', 'B', 2),
      ],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2'), item('p3'), item('p4')], cfg(10));

    expect(result.optimized).toBe(false);
    expect(result.stores).toHaveLength(1);
    expect(result.baseline).toEqual({ merchantId: 'A', name: 'Albert Heijn', total: 14 });
    expect(result.stores[0].subtotal).toBe(14);
    expect(result.totalExpectedSaving).toBe(0);
  });

  it('splits into per-store sub-lists when the saving clears the threshold', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B],
      cells: [
        cell('p1', 'A', 2), cell('p1', 'B', 5),
        cell('p2', 'A', 2), cell('p2', 'B', 5),
        cell('p3', 'A', 5), cell('p3', 'B', 2),
        cell('p4', 'A', 5), cell('p4', 'B', 2),
      ],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2'), item('p3'), item('p4')], cfg(4));

    expect(result.optimized).toBe(true);
    expect(result.stores).toHaveLength(2);
    expect(result.totalExpectedSaving).toBe(6);
    const primary = result.stores.find(s => s.isPrimary)!;
    expect(primary.merchantId).toBe('A');
    expect(primary.lines.map(l => l.productId).sort()).toEqual(['p1', 'p2']);
  });

  it('caps the number of stores, sending dropped products back to the main store', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B, C],
      cells: [
        cell('p1', 'A', 2), cell('p1', 'B', 5), cell('p1', 'C', 5),
        cell('p2', 'B', 1), cell('p2', 'A', 5), cell('p2', 'C', 5),
        cell('p3', 'C', 4), cell('p3', 'A', 5), cell('p3', 'B', 5),
      ],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2'), item('p3')], cfg(2, 2));

    expect(result.stores).toHaveLength(2); // main (B) + 1 secondary, C dropped by the cap
    expect(result.totalExpectedSaving).toBe(3);
  });

  it('merges a sub-list whose marginal saving is below €1.50 into the main store', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B, C],
      cells: [
        cell('p1', 'A', 1), cell('p1', 'B', 10), cell('p1', 'C', 10),
        cell('p2', 'A', 10), cell('p2', 'B', 1), cell('p2', 'C', 10),
        cell('p3', 'A', 10), cell('p3', 'B', 10), cell('p3', 'C', 9),
      ],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2'), item('p3')], cfg(2));

    expect(result.stores).toHaveLength(2); // C (saving 1.0) merged into main A
    expect(result.totalExpectedSaving).toBe(9);
    const primary = result.stores.find(s => s.isPrimary)!;
    expect(primary.lines.map(l => l.productId).sort()).toEqual(['p1', 'p3']);
  });

  it('does not split when every candidate sub-list is below the marginal threshold', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B, C],
      cells: [
        cell('p1', 'A', 4), cell('p1', 'B', 3), cell('p1', 'C', 4),
        cell('p2', 'A', 4), cell('p2', 'B', 4), cell('p2', 'C', 3),
      ],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2')], cfg(0.5));

    expect(result.optimized).toBe(false);
    expect(result.stores).toHaveLength(1);
    expect(result.reason).toBe('splits below marginal threshold');
  });

  it('keeps a main-unstocked item at its secondary instead of a phantom price on main', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B],
      cells: [
        cell('p1', 'A', 1), cell('p1', 'B', 2),
        cell('p2', 'A', 1), cell('p2', 'B', 2),
        cell('p4', 'A', 2), cell('p4', 'B', 1), // drives a small saving at B
        cell('p3', 'B', 1),                      // only B stocks p3
      ],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2'), item('p4'), item('p3')], cfg(0.5, 3));

    expect(result.optimized).toBe(true);
    expect(result.stores).toHaveLength(2);

    const primary = result.stores.find(s => s.isPrimary)!;
    expect(primary.merchantId).toBe('A');
    expect(primary.lines.map(l => l.productId)).not.toContain('p3');

    const secondary = result.stores.find(s => !s.isPrimary)!;
    const p3Line = secondary.lines.find(l => l.productId === 'p3')!;
    expect(secondary.merchantId).toBe('B');
    expect(p3Line.expectedPrice).toBe(1);
    expect(p3Line.observationCount).toBeGreaterThan(0);
  });

  it('fills a missing cell with the user historical average at low confidence', () => {
    const matrix: PriceMatrix = {
      merchants: [A],
      cells: [cell('p1', 'A', 5, 12, '2026-06-11')],
      userAverages: { p2: 3 },
    };
    const result = run(matrix, [item('p1', 'Milk'), item('p2', 'Eggs')], cfg(5));

    const line = result.stores[0].lines.find(l => l.productId === 'p2')!;
    expect(line.expectedPrice).toBe(3);
    expect(line.confidence).toBe('low');
    expect(line.observationCount).toBe(0);
  });

  it('fills a missing cell with the best-known price when there is no user average', () => {
    const matrix: PriceMatrix = {
      merchants: [A, B],
      cells: [cell('p1', 'A', 5), cell('p2', 'B', 4)],
      userAverages: {},
    };
    const result = run(matrix, [item('p1'), item('p2')], cfg(5));

    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].subtotal).toBe(9); // p1 @5 (A) + p2 @4 (best-known, no A cell)
  });

  it('grades per-line confidence from observation count and age', () => {
    const matrixWith = (obs: number, on: string): PriceMatrix => ({
      merchants: [A], cells: [cell('p1', 'A', 5, obs, on)], userAverages: {},
    });
    const conf = (obs: number, on: string) => run(matrixWith(obs, on), [item('p1')], cfg(5)).stores[0].lines[0].confidence;

    expect(conf(12, '2026-06-11')).toBe('high');
    expect(conf(5, '2026-06-11')).toBe('medium');
    expect(conf(2, '2026-06-11')).toBe('low');
    expect(conf(20, '2026-01-01')).toBe('low'); // stale (>90 days) despite many observations
  });
});
