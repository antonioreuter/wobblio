import { describe, it, expect } from 'vitest';
import { activeListLimit, isShoppingListCategoryId } from '@core/domain/shoppingList';

describe('activeListLimit', () => {
  it('caps STANDARD users at 3 active lists', () => {
    expect(activeListLimit('STANDARD')).toBe(3);
  });

  it('caps PREMIUM and other roles at 10 active lists', () => {
    expect(activeListLimit('PREMIUM')).toBe(10);
    expect(activeListLimit('ADMIN')).toBe(10);
  });
});

describe('isShoppingListCategoryId', () => {
  it('accepts Groceries and Drugstores', () => {
    expect(isShoppingListCategoryId('cat-groceries')).toBe(true);
    expect(isShoppingListCategoryId('cat-personal-care')).toBe(true);
  });

  it('rejects any other category', () => {
    expect(isShoppingListCategoryId('cat-electronics')).toBe(false);
    expect(isShoppingListCategoryId('not-a-category')).toBe(false);
  });
});
