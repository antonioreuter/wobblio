import { describe, it, expect } from 'vitest';
import {
  computeMatchedBasketInflation,
  MIN_INFLATION_BASKET,
  type MatchedBasketItem,
} from '@core/domain/personalInflation';

const item = (productId: string, priorMedian: number, currentMedian: number): MatchedBasketItem => ({
  productId,
  priorMedian,
  currentMedian,
});

describe('computeMatchedBasketInflation', () => {
  it('returns the median of per-product price ratios as a signed percentage', () => {
    // ratios: 1.10, 1.00, 1.20 → median 1.10 → +10.0%
    const basket = [item('a', 100, 110), item('b', 100, 100), item('c', 100, 120)];
    const result = computeMatchedBasketInflation(basket);
    expect(result.inflationPct).toBe(10);
    expect(result.basketSize).toBe(3);
  });

  it('is robust to one product spiking (median, not mean)', () => {
    // ratios: 1.00, 1.00, 1.00, 5.00 → median 1.00 → 0.0%, not the mean (+150%)
    const basket = [item('a', 10, 10), item('b', 10, 10), item('c', 10, 10), item('d', 10, 50)];
    expect(computeMatchedBasketInflation(basket).inflationPct).toBe(0);
  });

  it('reports deflation as a negative percentage', () => {
    const basket = [item('a', 100, 90), item('b', 100, 90), item('c', 100, 90)];
    expect(computeMatchedBasketInflation(basket).inflationPct).toBe(-10);
  });

  it('returns null (never 0) when the basket is below the minimum size', () => {
    const basket = [item('a', 100, 110), item('b', 100, 120)]; // only 2 < MIN
    const result = computeMatchedBasketInflation(basket);
    expect(result.inflationPct).toBeNull();
    expect(result.basketSize).toBe(2);
    expect(MIN_INFLATION_BASKET).toBe(3);
  });

  it('drops items with a zero or missing period median before counting the basket', () => {
    // 'bad' has a zero prior median (division would be Infinity) → excluded, leaving only 2 valid → null
    const basket = [item('a', 100, 110), item('b', 100, 120), item('bad', 0, 50)];
    const result = computeMatchedBasketInflation(basket);
    expect(result.inflationPct).toBeNull();
    expect(result.basketSize).toBe(2);
  });

  it('averages the two middle ratios for an even-sized basket', () => {
    // ratios: 1.00, 1.10, 1.20, 1.30 → median (1.10+1.20)/2 = 1.15 → +15.0%
    const basket = [item('a', 100, 100), item('b', 100, 110), item('c', 100, 120), item('d', 100, 130)];
    expect(computeMatchedBasketInflation(basket).inflationPct).toBe(15);
  });

  it('rounds to one decimal place', () => {
    // ratios: 1.0, 1.0, 1.077 → median 1.0? no — sorted [1.0,1.0,1.077] median 1.0 → 0
    // use three distinct so median is the middle: 1.033,1.077,1.121 → median 1.077 → +7.7%
    const basket = [item('a', 300, 310), item('b', 300, 323), item('c', 300, 336)];
    expect(computeMatchedBasketInflation(basket).inflationPct).toBe(7.7);
  });
});
