import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import type { IMerchantCatalog, MerchantAliasMatch } from '@core/ports/data-intelligence/IMerchantCatalog';
import type { BedrockSpendGuardService } from '@core/services/ai/BedrockSpendGuardService';
import type { MockedObject } from 'vitest';

const converseResult = (content: string) => ({ content, inputTokens: 1, outputTokens: 1, modelId: 'm', durationMs: 1 });

const match = (overrides: Partial<MerchantAliasMatch> = {}): MerchantAliasMatch => ({
  merchantId: 'm-exact',
  branchId: null,
  brandName: 'Albert Heijn',
  similarity: 1,
  ...overrides,
});

describe('MerchantResolver', () => {
  let catalog: MockedObject<IMerchantCatalog>;
  let callWithSpendGuard: ReturnType<typeof vi.fn>;
  let sut: MerchantResolver;

  beforeEach(() => {
    catalog = {
      findExactAlias: vi.fn(),
      findFuzzyAliases: vi.fn(),
      createProvisionalMerchant: vi.fn(),
      writeAlias: vi.fn(),
      getDefaultCategory: vi.fn(),
    };
    callWithSpendGuard = vi.fn();
    const spendGuard = { callWithSpendGuard } as unknown as BedrockSpendGuardService;
    sut = new MerchantResolver(catalog, spendGuard, 'model');
  });

  it('resolves an exact alias hit without fuzzy or LLM', async () => {
    catalog.findExactAlias.mockResolvedValue(match());

    const result = await sut.resolve('t1', 'Albert Heijn', 'NL');

    expect(result).toEqual({ merchantId: 'm-exact', branchId: null, brandName: 'Albert Heijn', provisional: false, confidence: 1 });
    expect(catalog.findFuzzyAliases).not.toHaveBeenCalled();
    expect(callWithSpendGuard).not.toHaveBeenCalled();
  });

  it('accepts a confident fuzzy match and writes back an AUTO_FUZZY alias', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([match({ merchantId: 'm-fuzzy', similarity: 0.8 })]);

    const result = await sut.resolve('t1', 'Albrt Heijn', 'NL');

    expect(result.merchantId).toBe('m-fuzzy');
    expect(result.provisional).toBe(false);
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'm-fuzzy', source: 'AUTO_FUZZY' }));
    expect(callWithSpendGuard).not.toHaveBeenCalled();
  });

  it('falls back to the LLM when the fuzzy margin is too small', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([
      match({ merchantId: 'a', similarity: 0.7 }),
      match({ merchantId: 'b', similarity: 0.68 }),
    ]);
    callWithSpendGuard.mockResolvedValue(converseResult('{"merchant_id":"a","is_new":false,"brand_name":"Aldi"}'));

    const result = await sut.resolve('t1', 'whatever', 'NL');

    expect(result).toEqual({ merchantId: 'a', branchId: null, brandName: 'Aldi', provisional: false, confidence: 0.8 });
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'a', source: 'AUTO_LLM' }));
  });

  it('falls back to the LLM when there is no fuzzy candidate', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([]);
    catalog.createProvisionalMerchant.mockResolvedValue('m-new');
    callWithSpendGuard.mockResolvedValue(converseResult('{"merchant_id":null,"is_new":true,"brand_name":"New Shop"}'));

    const result = await sut.resolve('t1', 'New Shop', 'NL');

    expect(result).toEqual({ merchantId: 'm-new', branchId: null, brandName: 'New Shop', provisional: true, confidence: 0.5 });
    expect(catalog.createProvisionalMerchant).toHaveBeenCalledWith('New Shop', 'NL', null);
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'm-new', source: 'AUTO_LLM' }));
  });

  it('persists the LLM-proposed category prior onto a new provisional merchant', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([]);
    catalog.createProvisionalMerchant.mockResolvedValue('m-new');
    callWithSpendGuard.mockResolvedValue(converseResult('{"merchant_id":null,"is_new":true,"brand_name":"Gamma","default_category_id":"cat-hardware"}'));

    await sut.resolve('t1', 'GAMMA', 'NL');

    expect(catalog.createProvisionalMerchant).toHaveBeenCalledWith('Gamma', 'NL', 'cat-hardware');
  });

  it('falls back to the LLM when the top fuzzy similarity is below the floor', async () => {
    catalog.findExactAlias.mockResolvedValue(null);
    catalog.findFuzzyAliases.mockResolvedValue([match({ similarity: 0.4 })]);
    catalog.createProvisionalMerchant.mockResolvedValue('m-new');
    callWithSpendGuard.mockResolvedValue(converseResult('{"merchant_id":null,"is_new":true,"brand_name":"Obscure"}'));

    const result = await sut.resolve('t1', 'Obscure', 'NL');

    expect(result.provisional).toBe(true);
  });
});
