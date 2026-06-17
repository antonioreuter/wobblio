export interface ListSummary {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
}

export interface ListItem {
  id: string;
  freeText: string;
  productId: string | null;
  checked: boolean;
  position: number;
  updatedAt: string;
}

export interface ListDetail {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  completedAt: string | null;
  items: ListItem[];
}

export interface ItemPatch {
  checked?: boolean;
  freeText?: string;
  productId?: string | null;
}

export interface IShoppingListRepository {
  countActive(): Promise<number>;
  create(tenantId: string, name: string): Promise<string>;
  listActive(): Promise<ListSummary[]>;
  getDetail(listId: string): Promise<ListDetail | null>;
  // Returns null when the list does not exist (or is not active) for the caller.
  addItem(listId: string, freeText: string, productId: string | null): Promise<string | null>;
  updateItem(listId: string, itemId: string, patch: ItemPatch): Promise<boolean>;
  removeItem(listId: string, itemId: string): Promise<boolean>;
  complete(listId: string): Promise<boolean>;
}
