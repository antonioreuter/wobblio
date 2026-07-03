import 'package:equatable/equatable.dart';

/// One shopping-list line (`GET /lists/{id}` → `items`). [productId] is null
/// for free-text items with no linked catalog product — the optimizer
/// (`OptimizationResult`) can't price or store-group those; they surface
/// under `unresolvedItems` instead.
class ShoppingListItem extends Equatable {
  const ShoppingListItem({
    required this.id,
    required this.freeText,
    required this.productId,
    required this.checked,
    required this.quantity,
    required this.position,
    required this.updatedAt,
  });

  final String id;
  final String freeText;
  final String? productId;
  final bool checked;
  final double quantity;
  final int position;
  final String updatedAt; // ISO timestamp

  @override
  List<Object?> get props =>
      [id, freeText, productId, checked, quantity, position, updatedAt];
}

/// The full payload for one shopping list (`GET /lists/{id}`).
class ShoppingListDetail extends Equatable {
  const ShoppingListDetail({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.regionCode,
    required this.countryCode,
    required this.isActive,
    required this.createdAt,
    required this.completedAt,
    required this.items,
  });

  final String id;
  final String name;
  final String categoryId;
  final String? regionCode;
  final String? countryCode;
  final bool isActive;
  final String createdAt;
  final String? completedAt;
  final List<ShoppingListItem> items;

  @override
  List<Object?> get props => [
        id,
        name,
        categoryId,
        regionCode,
        countryCode,
        isActive,
        createdAt,
        completedAt,
        items,
      ];
}
