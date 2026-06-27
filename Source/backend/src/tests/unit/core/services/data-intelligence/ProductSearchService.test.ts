import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ProductSearchService } from '@core/services/data-intelligence/ProductSearchService';
import type { IProductSearch, ProductSearchResult } from '@core/ports/data-intelligence/IProductSearch';

const match: ProductSearchResult = {
  productId: 'p1', displayName: 'Halfvolle Melk', brand: 'AH',
  categoryId: 'cat-dairy', baseUnit: 'L', packSizeBaseUnits: 1,
  ownMerchantCount: 1, ownMerchantName: 'Albert Heijn',
  marketMerchantCount: 3, marketMerchantName: null,
};

describe('ProductSearchService', () => {
  let products: MockedObject<IProductSearch>;
  let sut: ProductSearchService;

  beforeEach(() => {
    products = { search: vi.fn().mockResolvedValue([match]) };
    sut = new ProductSearchService(products);
  });

  it('returns nothing for a query shorter than 2 characters', async () => {
    expect(await sut.search('m')).toEqual([]);
    expect(products.search).not.toHaveBeenCalled();
  });

  it('trims the query and delegates with the default limit', async () => {
    const result = await sut.search('  melk  ');
    expect(result).toEqual([match]);
    expect(products.search).toHaveBeenCalledWith('melk', 10, '', '');
  });

  it('passes the merchant-signal fields straight through', async () => {
    const [r] = await sut.search('melk');
    expect(r.ownMerchantName).toBe('Albert Heijn');
    expect(r.marketMerchantCount).toBe(3);
    expect(r.marketMerchantName).toBeNull();
  });

  it('clamps the limit to the maximum', async () => {
    await sut.search('melk', 100);
    expect(products.search).toHaveBeenCalledWith('melk', 25, '', '');
  });

  it('forwards the region scope to the adapter', async () => {
    await sut.search('melk', 10, 'NL', 'NL-NB');
    expect(products.search).toHaveBeenCalledWith('melk', 10, 'NL', 'NL-NB');
  });
});
