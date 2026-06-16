import { describe, it, expect } from 'vitest';
import { resolveObservationRegion } from '@core/domain/region';

describe('resolveObservationRegion', () => {
  it('uses the contributor region when present', () => {
    expect(resolveObservationRegion('NL-NB', 'NL')).toBe('NL-NB');
  });

  it('falls back to the country code when the region is null', () => {
    expect(resolveObservationRegion(null, 'NL')).toBe('NL');
  });

  it('falls back to the country code when the region is undefined', () => {
    expect(resolveObservationRegion(undefined, 'BR')).toBe('BR');
  });

  it('falls back to the country code when the region is blank', () => {
    expect(resolveObservationRegion('   ', 'US')).toBe('US');
  });
});
