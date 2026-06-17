import { describe, it, expect } from 'vitest';
import { weekStart } from '@core/domain/week';

describe('weekStart', () => {
  it('returns the same day for a Monday', () => {
    expect(weekStart('2026-06-15')).toBe('2026-06-15');
  });

  it('returns the week Monday for a mid-week day', () => {
    expect(weekStart('2026-06-17')).toBe('2026-06-15');
  });

  it('returns the previous Monday for a Sunday', () => {
    expect(weekStart('2026-06-21')).toBe('2026-06-15');
  });
});
