import type {
  IShoppingListRepository,
  ListSummary,
  ListDetail,
  ItemPatch,
} from '../../ports/lists/IShoppingListRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import { activeListLimit } from '../../domain/shoppingList';
import {
  InvalidListError,
  ListLimitError,
  ListNotFoundError,
  ListItemNotFoundError,
} from '../../domain/errors';

export class ShoppingListService {
  constructor(private readonly lists: IShoppingListRepository) {}

  async create(userId: string, role: UserRole, name: string): Promise<string> {
    const cleanName = name.trim();
    if (!cleanName) throw new InvalidListError('name is required');

    const active = await this.lists.countActive();
    if (active >= activeListLimit(role)) throw new ListLimitError(activeListLimit(role));

    return this.lists.create(userId, cleanName);
  }

  list(): Promise<ListSummary[]> {
    return this.lists.listActive();
  }

  async getDetail(listId: string): Promise<ListDetail> {
    const detail = await this.lists.getDetail(listId);
    if (!detail) throw new ListNotFoundError(listId);
    return detail;
  }

  async addItem(listId: string, freeText: string, productId: string | null): Promise<string> {
    const cleanText = freeText.trim();
    if (!cleanText) throw new InvalidListError('item text is required');

    const itemId = await this.lists.addItem(listId, cleanText, productId);
    if (!itemId) throw new ListNotFoundError(listId);
    return itemId;
  }

  async updateItem(listId: string, itemId: string, patch: ItemPatch): Promise<void> {
    if (patch.checked === undefined && patch.freeText === undefined && patch.productId === undefined) {
      throw new InvalidListError('no fields to update');
    }
    const updated = await this.lists.updateItem(listId, itemId, patch);
    if (!updated) throw new ListItemNotFoundError(itemId);
  }

  async removeItem(listId: string, itemId: string): Promise<void> {
    const removed = await this.lists.removeItem(listId, itemId);
    if (!removed) throw new ListItemNotFoundError(itemId);
  }

  async complete(listId: string): Promise<void> {
    const completed = await this.lists.complete(listId);
    if (!completed) throw new ListNotFoundError(listId);
  }
}
