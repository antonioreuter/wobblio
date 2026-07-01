import type { UserRole } from '@core/ports/identity/IAppUserRepository';

export const STANDARD_ACTIVE_LISTS = 3;
export const PREMIUM_ACTIVE_LISTS = 10;

// Active-list cap by role (§10): STANDARD gets 3, everyone else 10.
export function activeListLimit(role: UserRole): number {
  return role === 'STANDARD' ? STANDARD_ACTIVE_LISTS : PREMIUM_ACTIVE_LISTS;
}

// A list is locked to exactly one of these two macro categories at creation
// (§10b) — item search only ever surfaces products under the chosen macro.
// 'cat-personal-care' is the taxonomy's "Personal Care & Pharmacy" macro; it
// doubles as the Drugstore bucket since there is no separate drugstore macro.
export const SHOPPING_LIST_CATEGORY_IDS = ['cat-groceries', 'cat-personal-care'] as const;
export type ShoppingListCategoryId = (typeof SHOPPING_LIST_CATEGORY_IDS)[number];

export const SHOPPING_LIST_CATEGORY_LABELS: Record<ShoppingListCategoryId, string> = {
  'cat-groceries': 'Groceries',
  'cat-personal-care': 'Drugstores',
};

export function isShoppingListCategoryId(id: string): id is ShoppingListCategoryId {
  return (SHOPPING_LIST_CATEGORY_IDS as readonly string[]).includes(id);
}
