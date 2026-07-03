import 'package:equatable/equatable.dart';

/// A row in the caller's shopping-list list (`GET /lists`). Lists are
/// per-user, not household-scoped — see
/// `specs/mvp/18-mobile-navigation-and-lists/18c-shopping-list.md`.
class ShoppingListSummary extends Equatable {
  const ShoppingListSummary({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.itemCount,
    required this.createdAt,
  });

  final String id;
  final String name;

  /// 'cat-groceries' | 'cat-personal-care' — immutable after creation
  /// ("category lock").
  final String categoryId;
  final int itemCount;
  final String createdAt; // ISO timestamp

  @override
  List<Object?> get props => [id, name, categoryId, itemCount, createdAt];
}
