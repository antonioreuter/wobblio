import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import type { IMerchantCatalog, MerchantAliasMatch } from '@core/ports/data-intelligence/IMerchantCatalog';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import type { MockedObject } from 'vitest';

const converseResult = (content: string) => ({ content, inputTokens: 1, outputTokens: 1, modelId: 'm', durationMs: 1 });

const match = (overrides: Partial<MerchantAliasMatch> = {}): MerchantAliasMatch => ({
  merchantId: 'm-exact',
  brandName: 'Albert Heijn',
  similarity: 1,
  defaultCategoryId: null,
  ...overrides,
});

describe('MerchantResolver', () => {
  let catalog: MockedObject<IMerchantCatalog>;
  let converse: ReturnType<typeof vi.fn>;
  let sut: MerchantResolver;

  beforeEach(() => {
    catalog = {
      findExactAlias: vi.fn(),
      findFuzzyAliases: vi.fn(),
      findBrandCandidates: vi.fn().mockResolvedValue([]),
      createProvisionalMerchant: vi.fn(),
      writeAlias: vi.fn(),
      getDefaultCategory: vi.fn().mockResolvedValue(null),
    };
    converse = vi.fn();
    sut = new MerchantResolver(catalog, { converse } as unknown as IBedrockConverse, 'model');
  });

  it('resolves an exact alias hit without fuzzy or LLM', async () => {
    catalog.findExactAlias.mockResolvedValue(match());

    const result = await sut.resolve('Albert Heijn', 'NL');

    expect(result).toEqual({ merchantId: 'm-exact', brandName: 'Albert Heijn', defaultCategoryId: null, provisional: false, confidence: 1 });
    expect(catalog.findFuzzyAliases).not.toHaveBeenCalled();
    expect(converse).not.toHaveBeenCalled();
  });

  it('surfaces the merchant macro prior (the §6.3 venue hint) carried in the alias match', async () => {
    catalog.findExactAlias.mockResolvedValue(match({ merchantId: 'm-mcd', brandName: "McDonald's", defaultCategoryId: 'cat-dining-out' }));

    const result = await sut.resolve("McDonald's", 'NL');

    expect(result.defaultCategoryId).toBe('cat-dining-out');
    // Prior comes from the alias JOIN — no follow-up getDefaultCategory query on the hot path.
    expect(catalog.getDefaultCategory).not.toHaveBeenCalled();
  });

  it('accepts a confident fuzzy match and writes back the resolved brand as an AUTO_FUZZY alias', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([match({ merchantId: 'm-fuzzy', similarity: 0.8 })]);

    const result = await sut.resolve('Albrt Heijn', 'NL');

    expect(result.merchantId).toBe('m-fuzzy');
    expect(result.provisional).toBe(false);
    // The clean brand form is written, not the raw receipt string.
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({
      merchantId: 'm-fuzzy', source: 'AUTO_FUZZY', aliasNormalized: 'ALBERT HEIJN',
    }));
    expect(converse).not.toHaveBeenCalled();
  });

  it('falls back to the LLM when the fuzzy margin is too small', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([
      match({ merchantId: 'a', similarity: 0.7 }),
      match({ merchantId: 'b', similarity: 0.68 }),
    ]);
    converse.mockResolvedValue(converseResult('{"merchant_id":"a","is_new":false,"brand_name":"Aldi"}'));

    const result = await sut.resolve('whatever', 'NL');

    expect(result).toEqual({ merchantId: 'a', brandName: 'Aldi', defaultCategoryId: null, provisional: false, confidence: 0.8 });
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'a', source: 'AUTO_LLM' }));
  });

  it('matches an existing brand via brand-level candidates instead of creating a duplicate', async () => {
    // The over-captured header misses exact + fuzzy alias, but the brand candidate lets the
    // LLM recognise the seeded merchant — no provisional merchant is created.
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([]);
    catalog.findBrandCandidates.mockResolvedValue([{ merchantId: 'm-seed', brandName: 'Albert Heijn' }]);
    converse.mockResolvedValue(converseResult('{"merchant_id":"m-seed","is_new":false,"brand_name":"Albert Heijn"}'));

    const result = await sut.resolve('Albert Heijn XL Eindhoven Winkelcentrum Woensel', 'NL');

    expect(result).toEqual({ merchantId: 'm-seed', brandName: 'Albert Heijn', defaultCategoryId: null, provisional: false, confidence: 0.8 });
    expect(catalog.createProvisionalMerchant).not.toHaveBeenCalled();
    expect(catalog.findBrandCandidates).toHaveBeenCalledWith('ALBERT HEIJN XL EINDHOVEN WINKELCENTRUM WOENSEL', 'NL', 5);
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({
      merchantId: 'm-seed', source: 'AUTO_LLM', aliasNormalized: 'ALBERT HEIJN',
    }));
  });

  it('creates a provisional merchant when no brand candidate matches', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([]);
    catalog.createProvisionalMerchant.mockResolvedValue('m-new');
    converse.mockResolvedValue(converseResult('{"merchant_id":null,"is_new":true,"brand_name":"New Shop"}'));

    const result = await sut.resolve('New Shop', 'NL');

    expect(result).toEqual({ merchantId: 'm-new', brandName: 'New Shop', defaultCategoryId: null, provisional: true, confidence: 0.5 });
    expect(catalog.createProvisionalMerchant).toHaveBeenCalledWith('New Shop', 'NL', null);
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'm-new', source: 'AUTO_LLM' }));
  });

  it('persists the LLM-proposed category prior onto a new provisional merchant', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([]);
    catalog.createProvisionalMerchant.mockResolvedValue('m-new');
    converse.mockResolvedValue(converseResult('{"merchant_id":null,"is_new":true,"brand_name":"Gamma","default_category_id":"cat-hardware"}'));

    await sut.resolve('GAMMA', 'NL');

    expect(catalog.createProvisionalMerchant).toHaveBeenCalledWith('Gamma', 'NL', 'cat-hardware');
  });

  it('falls back to the LLM when the top fuzzy similarity is below the floor', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([match({ similarity: 0.4 })]);
    catalog.createProvisionalMerchant.mockResolvedValue('m-new');
    converse.mockResolvedValue(converseResult('{"merchant_id":null,"is_new":true,"brand_name":"Obscure"}'));

    const result = await sut.resolve('Obscure', 'NL');

    expect(result.provisional).toBe(true);
  });
});
