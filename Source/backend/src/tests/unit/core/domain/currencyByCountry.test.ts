import { describe, it, expect } from 'vitest';
import { countryCurrency } from '@core/domain/currencyByCountry';

describe('countryCurrency', () => {
  it('maps the launch market and operating countries to their ISO-4217 currency', () => {
    expect(countryCurrency('NL')).toBe('EUR');
    expect(countryCurrency('DE')).toBe('EUR');
    expect(countryCurrency('GB')).toBe('GBP');
    expect(countryCurrency('US')).toBe('USD');
    expect(countryCurrency('CH')).toBe('CHF');
    expect(countryCurrency('PL')).toBe('PLN');
  });

  it('is case- and whitespace-insensitive on the country code', () => {
    expect(countryCurrency('nl')).toBe('EUR');
    expect(countryCurrency(' gb ')).toBe('GBP');
  });

  it('returns null for an unmapped country so the caller can fall back to the modal currency', () => {
    expect(countryCurrency('BR')).toBeNull();
    expect(countryCurrency('ZZ')).toBeNull();
    expect(countryCurrency('')).toBeNull();
  });
});
