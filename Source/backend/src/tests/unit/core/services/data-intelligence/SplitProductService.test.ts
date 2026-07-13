import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { SplitProductService } from '@core/services/data-intelligence/SplitProductService';
import type { IProductSplitRepository } from '@core/ports/data-intelligence/IProductSplitRepository';
import { ProductNotSplittableError } from '@core/domain/errors';

describe('SplitProductService', () => {
  let repo: MockedObject<IProductSplitRepository>;
  let sut: SplitProductService;

  beforeEach(() => {
    repo = {
      getParent: vi.fn().mockResolvedValue({
        merchantId: 'm1', displayName: 'Cola', categoryId: 'cat-soft-drinks', baseUnit: 'L', countryCode: 'NL',
      }),
      cloneVariant: vi.fn().mockResolvedValue('new-prod'),
      moveOwnLines: vi.fn().mockResolvedValue(['COLA 2L', 'COLA ZERO 2L']),
      writeConfirmedAliases: vi.fn(),
    };
    sut = new SplitProductService(repo);
  });

  it('clones a variant at the same merchant, moves the user’s lines, and writes USER_CONFIRMED aliases', async () => {
    const id = await sut.split({
      productId: 'p1', displayName: 'Cola 2L', size: { packQuantity: 2, baseUnit: 'L' }, lineIds: ['l1', 'l2'],
    });

    expect(id).toBe('new-prod');
    expect(repo.cloneVariant).toHaveBeenCalledWith(expect.objectContaining({ parentProductId: 'p1', merchantId: 'm1', displayName: 'Cola 2L' }));
    expect(repo.moveOwnLines).toHaveBeenCalledWith('p1', 'new-prod', ['l1', 'l2'], { packQuantity: 2, baseUnit: 'L' });
    expect(repo.writeConfirmedAliases).toHaveBeenCalledWith('new-prod', 'm1', ['COLA 2L', 'COLA ZERO 2L']);
  });

  it('rejects a split with no variant name', async () => {
    await expect(sut.split({ productId: 'p1', displayName: '  ', size: null, lineIds: ['l1'] }))
      .rejects.toBeInstanceOf(ProductNotSplittableError);
    expect(repo.cloneVariant).not.toHaveBeenCalled();
  });

  it('rejects a split with no selected purchases (never automatic)', async () => {
    await expect(sut.split({ productId: 'p1', displayName: 'Cola 2L', size: null, lineIds: [] }))
      .rejects.toBeInstanceOf(ProductNotSplittableError);
    expect(repo.cloneVariant).not.toHaveBeenCalled();
  });

  it('rejects splitting a merchant-agnostic legacy product', async () => {
    repo.getParent.mockResolvedValue({ merchantId: null, displayName: 'Cola', categoryId: 'cat-soft-drinks', baseUnit: 'L', countryCode: 'NL' });
    await expect(sut.split({ productId: 'p1', displayName: 'Cola 2L', size: null, lineIds: ['l1'] }))
      .rejects.toBeInstanceOf(ProductNotSplittableError);
  });

  it('404-style: rejects when the product does not exist', async () => {
    repo.getParent.mockResolvedValue(null);
    await expect(sut.split({ productId: 'gone', displayName: 'Cola 2L', size: null, lineIds: ['l1'] }))
      .rejects.toBeInstanceOf(ProductNotSplittableError);
  });

  it('skips alias write-back when no lines actually moved (all stale ids)', async () => {
    repo.moveOwnLines.mockResolvedValue([]);
    await sut.split({ productId: 'p1', displayName: 'Cola 2L', size: null, lineIds: ['l1'] });
    expect(repo.writeConfirmedAliases).not.toHaveBeenCalled();
  });
});
