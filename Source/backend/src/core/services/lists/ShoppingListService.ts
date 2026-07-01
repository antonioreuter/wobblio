import type {
  IShoppingListRepository,
  ListSummary,
  ListDetail,
  ItemPatch,
} from '../../ports/lists/IShoppingListRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import { activeListLimit, isShoppingListCategoryId } from '../../domain/shoppingList';
import { hasPremiumAccess } from '../../domain/access';
import {
  InvalidListError,
  ListLimitError,
  ListNotFoundError,
  ListItemNotFoundError,
  PremiumRequiredError,
} from '../../domain/errors';

export class ShoppingListService {
  constructor(private readonly lists: IShoppingListRepository) {}

  async create(userId: string, role: UserRole, name: string, categoryId: string): Promise<string> {
    const cleanName = name.trim();
    if (!cleanName) throw new InvalidListError('name is required');
    if (!isShoppingListCategoryId(categoryId)) throw new InvalidListError('categoryId must be Groceries or Drugstores');

    const active = await this.lists.countActive();
    if (active >= activeListLimit(role)) throw new ListLimitError(activeListLimit(role));

    return this.lists.create(userId, cleanName, categoryId);
  }

  list(): Promise<ListSummary[]> {
    return this.lists.listActive();
  }

  async getDetail(listId: string): Promise<ListDetail> {
    const detail = await this.lists.getDetail(listId);
    if (!detail) throw new ListNotFoundError(listId);
    return detail;
  }

  async addItem(listId: string, freeText: string, productId: string | null, quantity = 1): Promise<string> {
    const cleanText = freeText.trim();
    if (!cleanText) throw new InvalidListError('item text is required');
    if (!(quantity > 0)) throw new InvalidListError('quantity must be greater than 0');

    const itemId = await this.lists.addItem(listId, cleanText, productId, quantity);
    if (!itemId) throw new ListNotFoundError(listId);
    return itemId;
  }

  async updateItem(listId: string, itemId: string, patch: ItemPatch): Promise<void> {
    if (
      patch.checked === undefined && patch.freeText === undefined &&
      patch.productId === undefined && patch.quantity === undefined
    ) {
      throw new InvalidListError('no fields to update');
    }
    if (patch.quantity !== undefined && !(patch.quantity > 0)) {
      throw new InvalidListError('quantity must be greater than 0');
    }
    const updated = await this.lists.updateItem(listId, itemId, patch);
    if (!updated) throw new ListItemNotFoundError(itemId);
  }

  // Premium per-list region override (§10b/§10c). Standard users are rejected
  // outright rather than silently ignored, so the client gets an unambiguous
  // signal instead of a control that quietly does nothing.
  async setRegion(role: UserRole, listId: string, regionCode: string | null, countryCode: string | null): Promise<void> {
    if (!hasPremiumAccess(role) && (regionCode !== null || countryCode !== null)) {
      throw new PremiumRequiredError('shopping list region override');
    }
    // Both null (clear) or both set (override) — never partial. A list with only
    // one of the two set would let the optimizer's regionCode-then-countryCode
    // fallback chain (OptimizerService.optimize) pick a coarse, stale countryCode
    // over the shopper's own more specific profile region.
    if ((regionCode === null) !== (countryCode === null)) {
      throw new InvalidListError('regionCode and countryCode must be set or cleared together');
    }
    const updated = await this.lists.setRegion(listId, regionCode, countryCode);
    if (!updated) throw new ListNotFoundError(listId);
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
