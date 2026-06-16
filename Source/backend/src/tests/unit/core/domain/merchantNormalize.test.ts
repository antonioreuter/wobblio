import { describe, it, expect } from 'vitest';
import { normalizeMerchantName } from '@core/domain/merchantNormalize';

describe('normalizeMerchantName', () => {
  it('uppercases and collapses whitespace', () => {
    expect(normalizeMerchantName('Albert  Heijn')).toBe('ALBERT HEIJN');
  });

  it('strips a legal suffix with punctuation', () => {
    expect(normalizeMerchantName('Albert Heijn B.V.')).toBe('ALBERT HEIJN');
  });

  it('strips a GmbH suffix', () => {
    expect(normalizeMerchantName('Lidl GmbH')).toBe('LIDL');
  });

  it('folds accents', () => {
    expect(normalizeMerchantName('Café Olé')).toBe('CAFE OLE');
  });

  it('drops punctuation and leading empty tokens', () => {
    expect(normalizeMerchantName('.JUMBO - Supermarkt!')).toBe('JUMBO SUPERMARKT');
  });
});
