import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { OptimizerService } from '@core/services/optimizer/OptimizerService';
import type { IShoppingListRepository, ListDetail } from '@core/ports/lists/IShoppingListRepository';
import type { IPriceMatrix } from '@core/ports/optimizer/IPriceMatrix';
import type { IRoutingConfig } from '@core/ports/optimizer/IRoutingConfig';
import type { IContributorContextRepository } from '@core/ports/data-intelligence/IContributorContextRepository';
import { PremiumRequiredError, ListNotFoundError } from '@core/domain/errors';

const detail: ListDetail = {
  id: 'l1', name: 'Groceries', categoryId: 'cat-groceries', regionCode: null, countryCode: null,
  isActive: true, createdAt: '', completedAt: null,
  items: [
    { id: 'i1', freeText: 'Milk', productId: 'p1', checked: false, quantity: 2, position: 0, updatedAt: '' },
    { id: 'i2', freeText: 'Birthday card', productId: null, checked: false, quantity: 1, position: 1, updatedAt: '' },
  ],
};

describe('OptimizerService', () => {
  let lists: MockedObject<IShoppingListRepository>;
  let priceMatrix: MockedObject<IPriceMatrix>;
  let routing: MockedObject<IRoutingConfig>;
  let contributorContext: MockedObject<IContributorContextRepository>;
  let sut: OptimizerService;

  beforeEach(() => {
    lists = {
      countActive: vi.fn(), create: vi.fn(), listActive: vi.fn(), getDetail: vi.fn(),
      addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), complete: vi.fn(), setRegion: vi.fn(),
    };
    priceMatrix = {
      build: vi.fn().mockResolvedValue({
        merchants: [{ id: 'A', name: 'AH' }, { id: 'B', name: 'Jumbo' }],
        cells: [
          { productId: 'p1', merchantId: 'A', price: 2, observationCount: 9, lastObservedOn: '2026-06-15' },
          { productId: 'p1', merchantId: 'B', price: 1, observationCount: 9, lastObservedOn: '2026-06-15' },
        ],
        userAverages: {},
      }),
    };
    routing = { get: vi.fn().mockResolvedValue({ minSplitSaving: 5, maxStores: 3 }) };
    contributorContext = { getContext: vi.fn().mockResolvedValue({ optedOut: false, regionCode: 'NL-NB', countryCode: 'NL', trustScore: 50, homeCurrency: 'EUR' }) };
    sut = new OptimizerService(lists, priceMatrix, routing, contributorContext);
  });

  it('requires a PREMIUM role', async () => {
    await expect(sut.optimize('u1', 'STANDARD', 'l1')).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(lists.getDetail).not.toHaveBeenCalled();
  });

  it('throws ListNotFoundError for an unknown list', async () => {
    lists.getDetail.mockResolvedValue(null);
    await expect(sut.optimize('u1', 'PREMIUM', 'ghost')).rejects.toBeInstanceOf(ListNotFoundError);
  });

  it('builds the matrix from resolved products in the user region and returns the optimization', async () => {
    lists.getDetail.mockResolvedValue(detail);

    const result = await sut.optimize('u1', 'PREMIUM', 'l1');

    expect(priceMatrix.build).toHaveBeenCalledWith(['p1'], 'NL-NB', 'NL', 'EUR');
    expect(result.unresolvedItems).toContain('Birthday card');
    expect(result.stores[0].lines[0].productId).toBe('p1');
    expect(result.stores[0].lines[0].quantity).toBe(2);
  });

  it('falls back to the contributor country code when the context has no region', async () => {
    lists.getDetail.mockResolvedValue(detail);
    contributorContext.getContext.mockResolvedValue({ optedOut: false, regionCode: null, countryCode: 'NL', trustScore: 50, homeCurrency: 'EUR' });

    await sut.optimize('u1', 'PREMIUM', 'l1');

    expect(priceMatrix.build).toHaveBeenCalledWith(['p1'], 'NL', 'NL', 'EUR');
  });

  it('prefers the list\'s Premium region override over the contributor context', async () => {
    lists.getDetail.mockResolvedValue({ ...detail, regionCode: 'NL-ZH', countryCode: 'NL' });

    await sut.optimize('u1', 'PREMIUM', 'l1');

    expect(priceMatrix.build).toHaveBeenCalledWith(['p1'], 'NL-ZH', 'NL', 'EUR');
  });

  it('drops excluded merchants from the candidate set before optimizing', async () => {
    lists.getDetail.mockResolvedValue(detail);

    const result = await sut.optimize('u1', 'PREMIUM', 'l1', ['B']);

    // B (the cheaper store) is excluded, so the item must land on A.
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].merchantId).toBe('A');
  });
});
