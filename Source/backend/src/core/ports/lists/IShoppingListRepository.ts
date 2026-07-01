export interface ListSummary {
  id: string;
  name: string;
  categoryId: string;
  itemCount: number;
  createdAt: string;
}

export interface ListItem {
  id: string;
  freeText: string;
  productId: string | null;
  checked: boolean;
  quantity: number;
  position: number;
  updatedAt: string;
}

export interface ListDetail {
  id: string;
  name: string;
  categoryId: string;
  regionCode: string | null;
  countryCode: string | null;
  isActive: boolean;
  createdAt: string;
  completedAt: string | null;
  items: ListItem[];
}

export interface ItemPatch {
  checked?: boolean;
  freeText?: string;
  productId?: string | null;
  quantity?: number;
}

export interface IShoppingListRepository {
  countActive(): Promise<number>;
  create(tenantId: string, name: string, categoryId: string): Promise<string>;
  listActive(): Promise<ListSummary[]>;
  getDetail(listId: string): Promise<ListDetail | null>;
  // Returns null when the list does not exist (or is not active) for the caller.
  addItem(listId: string, freeText: string, productId: string | null, quantity: number): Promise<string | null>;
  updateItem(listId: string, itemId: string, patch: ItemPatch): Promise<boolean>;
  removeItem(listId: string, itemId: string): Promise<boolean>;
  complete(listId: string): Promise<boolean>;
  // Premium per-list region override (§10b). Both null clears it (falls back to
  // the shopper's profile region). Returns false when the list doesn't exist.
  setRegion(listId: string, regionCode: string | null, countryCode: string | null): Promise<boolean>;
}
