import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { OptimizerService } from '@core/services/optimizer/OptimizerService';
import type { IShoppingListRepository, ListDetail } from '@core/ports/lists/IShoppingListRepository';
import type { IPriceMatrix } from '@core/ports/optimizer/IPriceMatrix';
import type { IRoutingConfig } from '@core/ports/optimizer/IRoutingConfig';
import type { IContributorContextRepository } from '@core/ports/data-intelligence/IContributorContextRepository';
import { PremiumRequiredError, ListNotFoundError } from '@core/domain/errors';

const detail: ListDetail = {
  id: 'l1', name: 'Groceries', isActive: true, createdAt: '', completedAt: null,
  items: [
    { id: 'i1', freeText: 'Milk', productId: 'p1', checked: false, position: 0, updatedAt: '' },
    { id: 'i2', freeText: 'Birthday card', productId: null, checked: false, position: 1, updatedAt: '' },
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
      addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), complete: vi.fn(),
    };
    priceMatrix = { build: vi.fn().mockResolvedValue({ merchants: [{ id: 'A', name: 'AH' }], cells: [{ productId: 'p1', merchantId: 'A', price: 2, observationCount: 9, lastObservedOn: '2026-06-15' }], userAverages: {} }) };
    routing = { get: vi.fn().mockResolvedValue({ minSplitSaving: 5, maxStores: 3 }) };
    contributorContext = { getContext: vi.fn().mockResolvedValue({ optedOut: false, regionCode: 'NL-NB', countryCode: 'NL', trustScore: 50 }) };
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

    expect(priceMatrix.build).toHaveBeenCalledWith(['p1'], 'NL-NB');
    expect(result.unresolvedItems).toContain('Birthday card');
    expect(result.stores[0].lines[0].productId).toBe('p1');
  });

  it('falls back to the contributor country code when the context has no region', async () => {
    lists.getDetail.mockResolvedValue(detail);
    contributorContext.getContext.mockResolvedValue({ optedOut: false, regionCode: null, countryCode: 'NL', trustScore: 50 });

    await sut.optimize('u1', 'PREMIUM', 'l1');

    expect(priceMatrix.build).toHaveBeenCalledWith(['p1'], 'NL');
  });
});
