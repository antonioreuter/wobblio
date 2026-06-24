import { describe, it, expect } from 'vitest';
import { resolveObservationRegion, resolveIngestionLocation } from '@core/domain/region';

describe('resolveIngestionLocation', () => {
  const profile = { countryCode: 'BR', regionCode: 'BR-BA' };

  it('tier 1: a receipt with a mapped region auto-resolves to RECEIPT', () => {
    const result = resolveIngestionLocation({
      receipt: { countryCode: 'NL', regionCode: 'NL-NB' },
      uploadGeo: { countryCode: 'DE', regionCode: 'DE-BY' },
      profile,
    });
    expect(result).toEqual({ countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'RECEIPT' });
  });

  it('tier 1b: receipt country only matching the profile country resolves via COUNTRY_WITH_PROFILE_REGION', () => {
    const result = resolveIngestionLocation({
      receipt: { countryCode: 'BR', regionCode: null },
      uploadGeo: { countryCode: 'NL', regionCode: 'NL-NB' },
      profile,
    });
    expect(result).toEqual({ countryCode: 'BR', regionCode: 'BR-BA', status: 'RESOLVED', source: 'COUNTRY_WITH_PROFILE_REGION' });
  });

  it('tier 1b: a receipt country that differs from the profile country does not resolve from the profile', () => {
    const result = resolveIngestionLocation({
      receipt: { countryCode: 'NL', regionCode: null },
      uploadGeo: null,
      profile,
    });
    expect(result).toEqual({ countryCode: 'BR', regionCode: 'BR-BA', status: 'PENDING', source: 'PROFILE' });
  });

  it('tier 2: no receipt region falls through to upload-geo as PENDING/GEO', () => {
    const result = resolveIngestionLocation({
      receipt: { countryCode: 'NL', regionCode: null },
      uploadGeo: { countryCode: 'NL', regionCode: 'NL-NB' },
      profile,
    });
    expect(result).toEqual({ countryCode: 'NL', regionCode: 'NL-NB', status: 'PENDING', source: 'GEO' });
  });

  it('tier 2: preserves a null upload-geo region prefill', () => {
    const result = resolveIngestionLocation({
      receipt: { countryCode: null, regionCode: null },
      uploadGeo: { countryCode: 'NL', regionCode: null },
      profile,
    });
    expect(result).toEqual({ countryCode: 'NL', regionCode: null, status: 'PENDING', source: 'GEO' });
  });

  it('tier 3: no receipt and no upload-geo falls back to the profile as PENDING/PROFILE', () => {
    const result = resolveIngestionLocation({
      receipt: { countryCode: null, regionCode: null },
      uploadGeo: null,
      profile,
    });
    expect(result).toEqual({ countryCode: 'BR', regionCode: 'BR-BA', status: 'PENDING', source: 'PROFILE' });
  });
});

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
