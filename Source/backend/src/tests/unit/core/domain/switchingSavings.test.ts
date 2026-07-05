import { describe, it, expect } from 'vitest';
import { computeSwitchingSavings, type SavingsLine } from '@core/domain/switchingSavings';

const line = (paidUnitPrice: number, regionMedian: number, quantity = 1): SavingsLine => ({
  paidUnitPrice,
  regionMedian,
  quantity,
});

describe('computeSwitchingSavings', () => {
  it('sums the below-median gap times quantity across lines', () => {
    // (2.00-1.50)*2 + (3.00-2.50)*1 = 1.00 + 0.50 = 1.50
    const saved = computeSwitchingSavings([line(1.5, 2.0, 2), line(2.5, 3.0, 1)]);
    expect(saved).toBe(1.5);
  });

  it('ignores lines paid at or above the region median (no negative savings)', () => {
    // paid above median contributes 0, not a negative
    const saved = computeSwitchingSavings([line(3.0, 2.0, 1), line(1.0, 2.0, 1)]);
    expect(saved).toBe(1.0);
  });

  it('returns null (never 0) when nothing is comparable', () => {
    expect(computeSwitchingSavings([])).toBeNull();
    expect(computeSwitchingSavings([line(0, 2.0, 1), line(1.0, 0, 1)])).toBeNull();
  });

  it('returns 0 when everything was bought at or above median (comparable but no saving)', () => {
    expect(computeSwitchingSavings([line(2.0, 2.0, 1)])).toBe(0);
  });

  it('rounds to cents', () => {
    expect(computeSwitchingSavings([line(1.111, 1.234, 1)])).toBe(0.12);
  });
});
