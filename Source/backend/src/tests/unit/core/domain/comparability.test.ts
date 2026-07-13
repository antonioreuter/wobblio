import { describe, it, expect } from 'vitest';
import { classifyComparability, type Offer } from '@core/domain/comparability';

const offer = (over: Partial<Offer> = {}): Offer => ({
  size: { packSize: null, baseUnit: null },
  sizeEquivalent: false,
  ambiguous: false,
  ...over,
});

describe('classifyComparability', () => {
  it('equal known sizes → comparable', () => {
    const self = offer({ size: { packSize: 2, baseUnit: 'L' } });
    const other = offer({ size: { packSize: 2, baseUnit: 'L' } });
    expect(classifyComparability(self, other)).toBe('comparable');
  });

  it('differing known sizes → watch_only (not comparable)', () => {
    const self = offer({ size: { packSize: 2, baseUnit: 'L' } });
    const other = offer({ size: { packSize: 1, baseUnit: 'L' } });
    expect(classifyComparability(self, other)).toBe('watch_only');
  });

  it('same amount but different base unit → watch_only', () => {
    const self = offer({ size: { packSize: 1, baseUnit: 'L' } });
    const other = offer({ size: { packSize: 1, baseUnit: 'KG' } });
    expect(classifyComparability(self, other)).toBe('watch_only');
  });

  it('one size unknown → watch_only', () => {
    const self = offer({ size: { packSize: 2, baseUnit: 'L' } });
    const other = offer({ size: { packSize: null, baseUnit: null } });
    expect(classifyComparability(self, other)).toBe('watch_only');
  });

  it('unknown sizes but user-confirmed size_equivalent → comparable', () => {
    const self = offer();
    const other = offer({ sizeEquivalent: true });
    expect(classifyComparability(self, other)).toBe('comparable');
  });

  it('ambiguous offer is never rankable, even with equal sizes or size_equivalent', () => {
    const self = offer({ size: { packSize: 2, baseUnit: 'L' } });
    const equalButAmbiguous = offer({ size: { packSize: 2, baseUnit: 'L' }, ambiguous: true });
    expect(classifyComparability(self, equalButAmbiguous)).toBe('ambiguous');

    const confirmedButSelfAmbiguous = offer({ sizeEquivalent: true });
    expect(classifyComparability(offer({ ambiguous: true }), confirmedButSelfAmbiguous)).toBe('ambiguous');
  });
});
