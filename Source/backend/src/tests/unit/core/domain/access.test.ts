import { describe, it, expect } from 'vitest';
import { hasPremiumAccess } from '@core/domain/access';

describe('hasPremiumAccess', () => {
  it('grants PREMIUM and the elevated operator roles', () => {
    expect(hasPremiumAccess('PREMIUM')).toBe(true);
    expect(hasPremiumAccess('ADMIN')).toBe(true);
    expect(hasPremiumAccess('TESTER')).toBe(true);
  });

  it('denies STANDARD', () => {
    expect(hasPremiumAccess('STANDARD')).toBe(false);
  });
});
