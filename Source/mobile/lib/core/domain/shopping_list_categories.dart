/// The two shopping-list macro categories a list is locked to at creation
/// ("category lock") — mirrors the backend's `SHOPPING_LIST_CATEGORY_IDS`
/// (`Source/backend/src/core/domain/shoppingList.ts`).
class ShoppingListCategories {
  const ShoppingListCategories._();

  static const groceries = 'cat-groceries';
  static const personalCare = 'cat-personal-care';

  static const labels = {
    groceries: 'Groceries',
    personalCare: 'Drugstores',
  };
}
