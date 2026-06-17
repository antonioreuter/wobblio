import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ShoppingListService } from '@core/services/lists/ShoppingListService';
import type { IShoppingListRepository, ListDetail } from '@core/ports/lists/IShoppingListRepository';
import { InvalidListError, ListLimitError, ListNotFoundError, ListItemNotFoundError } from '@core/domain/errors';

const detail: ListDetail = {
  id: 'l1', name: 'Groceries', isActive: true,
  createdAt: '2026-06-16T00:00:00Z', completedAt: null, items: [],
};

describe('ShoppingListService', () => {
  let repo: MockedObject<IShoppingListRepository>;
  let sut: ShoppingListService;

  beforeEach(() => {
    repo = {
      countActive: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      listActive: vi.fn(),
      getDetail: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      complete: vi.fn(),
    };
    sut = new ShoppingListService(repo);
  });

  describe('create', () => {
    it('rejects a blank name', async () => {
      await expect(sut.create('u1', 'PREMIUM', '  ')).rejects.toBeInstanceOf(InvalidListError);
    });

    it('enforces the STANDARD active-list limit', async () => {
      repo.countActive.mockResolvedValue(3);
      await expect(sut.create('u1', 'STANDARD', 'Groceries')).rejects.toBeInstanceOf(ListLimitError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the list for a premium user under the limit', async () => {
      repo.countActive.mockResolvedValue(5);
      repo.create.mockResolvedValue('l9');
      const id = await sut.create('u1', 'PREMIUM', '  Groceries  ');
      expect(id).toBe('l9');
      expect(repo.create).toHaveBeenCalledWith('u1', 'Groceries');
    });
  });

  describe('getDetail', () => {
    it('throws when the list is missing', async () => {
      repo.getDetail.mockResolvedValue(null);
      await expect(sut.getDetail('ghost')).rejects.toBeInstanceOf(ListNotFoundError);
    });

    it('returns the detail when found', async () => {
      repo.getDetail.mockResolvedValue(detail);
      expect(await sut.getDetail('l1')).toEqual(detail);
    });
  });

  describe('addItem', () => {
    it('rejects blank item text', async () => {
      await expect(sut.addItem('l1', '   ', null)).rejects.toBeInstanceOf(InvalidListError);
    });

    it('throws when the list is missing', async () => {
      repo.addItem.mockResolvedValue(null);
      await expect(sut.addItem('ghost', 'Milk', null)).rejects.toBeInstanceOf(ListNotFoundError);
    });

    it('adds a trimmed item and returns its id', async () => {
      repo.addItem.mockResolvedValue('i1');
      const id = await sut.addItem('l1', '  Milk  ', 'p1');
      expect(id).toBe('i1');
      expect(repo.addItem).toHaveBeenCalledWith('l1', 'Milk', 'p1');
    });
  });

  describe('item mutations', () => {
    it('rejects a patch with no defined fields', async () => {
      await expect(sut.updateItem('l1', 'i1', {})).rejects.toBeInstanceOf(InvalidListError);
      expect(repo.updateItem).not.toHaveBeenCalled();
    });

    it('throws when updating an unknown item', async () => {
      repo.updateItem.mockResolvedValue(false);
      await expect(sut.updateItem('l1', 'ghost', { checked: true })).rejects.toBeInstanceOf(ListItemNotFoundError);
    });

    it('updates an existing item', async () => {
      repo.updateItem.mockResolvedValue(true);
      await sut.updateItem('l1', 'i1', { checked: true });
      expect(repo.updateItem).toHaveBeenCalledWith('l1', 'i1', { checked: true });
    });

    it('throws when removing an unknown item', async () => {
      repo.removeItem.mockResolvedValue(false);
      await expect(sut.removeItem('l1', 'ghost')).rejects.toBeInstanceOf(ListItemNotFoundError);
    });

    it('removes an existing item', async () => {
      repo.removeItem.mockResolvedValue(true);
      await sut.removeItem('l1', 'i1');
      expect(repo.removeItem).toHaveBeenCalledWith('l1', 'i1');
    });
  });

  describe('complete', () => {
    it('throws when the list is missing', async () => {
      repo.complete.mockResolvedValue(false);
      await expect(sut.complete('ghost')).rejects.toBeInstanceOf(ListNotFoundError);
    });

    it('completes an active list', async () => {
      repo.complete.mockResolvedValue(true);
      await sut.complete('l1');
      expect(repo.complete).toHaveBeenCalledWith('l1');
    });
  });

  it('lists active lists', async () => {
    repo.listActive.mockResolvedValue([]);
    expect(await sut.list()).toEqual([]);
  });
});
