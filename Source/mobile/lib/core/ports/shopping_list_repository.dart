import 'package:wobblio/core/lists/optimization_result.dart';
import 'package:wobblio/core/lists/shopping_list_detail.dart';
import 'package:wobblio/core/lists/shopping_list_summary.dart';

/// A partial edit to one shopping-list item — mirrors the backend's `ItemPatch`
/// (only set fields are sent in the `PATCH` body).
class ShoppingListItemPatch {
  const ShoppingListItemPatch({this.checked, this.freeText, this.quantity});

  final bool? checked;
  final String? freeText;
  final double? quantity;
}

/// Port: the caller's own shopping lists (18c). Lists are per-user, not
/// household-scoped (see `specs/mvp/18-mobile-navigation-and-lists/18c-shopping-list.md`).
///
/// [list] → `GET /lists`. [getDetail] → `GET /lists/{id}`. [create] →
/// `POST /lists` (category-locked at creation — 'cat-groceries' |
/// 'cat-personal-care'). [addItem]/[updateItem]/[removeItem] → the
/// `/lists/{id}/items...` routes. [optimize] → `POST /lists/{id}/optimize`,
/// **Premium-gated** — a 403 surfaces as an [ApiException] with
/// `statusCode: 403`, which callers must catch explicitly rather than treat
/// as a generic failure. Concrete adapter lives in `infrastructure/adapters/`.
abstract class IShoppingListRepository {
  Future<List<ShoppingListSummary>> list();

  Future<ShoppingListDetail> getDetail(String listId);

  Future<String> create(String name, String categoryId);

  Future<String> addItem(String listId, String freeText,
      {String? productId, double quantity = 1,});

  Future<void> updateItem(
      String listId, String itemId, ShoppingListItemPatch patch,);

  Future<void> removeItem(String listId, String itemId);

  Future<OptimizationResult> optimize(String listId,
      {List<String> excludedMerchantIds = const [],});
}
