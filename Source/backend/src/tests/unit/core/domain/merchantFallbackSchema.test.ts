import { describe, it, expect } from 'vitest';
import { parseMerchantFallbackJson } from '@core/domain/merchantFallbackSchema';

describe('parseMerchantFallbackJson', () => {
  it('parses an existing-merchant match', () => {
    const result = parseMerchantFallbackJson('{"merchant_id":"m1","is_new":false,"brand_name":"Albert Heijn"}');
    expect(result).toEqual({ ok: true, value: { merchantId: 'm1', brandName: 'Albert Heijn', isNew: false, defaultCategoryId: null } });
  });

  it('parses a new merchant with a null id', () => {
    const result = parseMerchantFallbackJson('{"merchant_id":null,"is_new":true,"brand_name":"New Shop"}');
    expect(result).toEqual({ ok: true, value: { merchantId: null, brandName: 'New Shop', isNew: true, defaultCategoryId: null } });
  });

  it('defaults a missing merchant_id to null and trims the brand', () => {
    const result = parseMerchantFallbackJson('{"is_new":true,"brand_name":"  Spar  "}');
    expect(result).toEqual({ ok: true, value: { merchantId: null, brandName: 'Spar', isNew: true, defaultCategoryId: null } });
  });

  it('keeps a valid macro default_category_id prior', () => {
    const result = parseMerchantFallbackJson('{"merchant_id":null,"is_new":true,"brand_name":"Gamma","default_category_id":"cat-hardware"}');
    expect(result.ok && result.value.defaultCategoryId).toBe('cat-hardware');
  });

  it('rolls a sub-category prior up to its macro', () => {
    const result = parseMerchantFallbackJson('{"is_new":true,"brand_name":"Gamma","default_category_id":"cat-paint"}');
    expect(result.ok && result.value.defaultCategoryId).toBe('cat-hardware');
  });

  it('drops an unknown default_category_id to null without failing the parse', () => {
    const result = parseMerchantFallbackJson('{"is_new":true,"brand_name":"X","default_category_id":"cat-bogus"}');
    expect(result.ok && result.value.defaultCategoryId).toBe(null);
  });

  it('extracts JSON from a code fence', () => {
    const result = parseMerchantFallbackJson('```json\n{"is_new":true,"brand_name":"X"}\n```');
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(parseMerchantFallbackJson('not json')).toEqual({ ok: false, issues: 'output is not valid JSON' });
  });

  it('rejects non-object JSON', () => {
    expect(parseMerchantFallbackJson('123')).toEqual({ ok: false, issues: 'output must be a JSON object' });
  });

  it('reports field-level issues', () => {
    const result = parseMerchantFallbackJson('{"is_new":"yes","brand_name":"","merchant_id":5}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('brand_name');
      expect(result.issues).toContain('is_new');
      expect(result.issues).toContain('merchant_id');
    }
  });
});
