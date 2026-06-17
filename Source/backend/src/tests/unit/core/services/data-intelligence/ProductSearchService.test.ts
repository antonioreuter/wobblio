import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ProductSearchService } from '@core/services/data-intelligence/ProductSearchService';
import type { IProductSearch, ProductSearchResult } from '@core/ports/data-intelligence/IProductSearch';

const match: ProductSearchResult = {
  productId: 'p1', displayName: 'Halfvolle Melk', brand: 'AH',
  categoryId: 'cat-dairy', baseUnit: 'L', packSizeBaseUnits: 1,
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
    expect(products.search).toHaveBeenCalledWith('melk', 10);
  });

  it('clamps the limit to the maximum', async () => {
    await sut.search('melk', 100);
    expect(products.search).toHaveBeenCalledWith('melk', 25);
  });
});
