part of 'shopping_list_bloc.dart';

sealed class ShoppingListEvent extends Equatable {
  const ShoppingListEvent();

  @override
  List<Object?> get props => [];
}

/// First load: fetch lists, load the first active one's detail, and (Premium
/// only) attempt the split-route optimizer.
class ShoppingListStarted extends ShoppingListEvent {
  const ShoppingListStarted();
}

/// Pull-to-refresh: reload the active list + optimizer result.
class ShoppingListRefreshed extends ShoppingListEvent {
  const ShoppingListRefreshed();
}

/// "Create list" (empty state) — [categoryId] is 'cat-groceries' |
/// 'cat-personal-care', locked for the list's lifetime.
class ShoppingListCreateRequested extends ShoppingListEvent {
  const ShoppingListCreateRequested(this.name, this.categoryId);

  final String name;
  final String categoryId;

  @override
  List<Object?> get props => [name, categoryId];
}

/// "Add item" submitted.
class ShoppingListItemAdded extends ShoppingListEvent {
  const ShoppingListItemAdded(this.freeText);

  final String freeText;

  @override
  List<Object?> get props => [freeText];
}

/// Row tapped — optimistically toggles checked, reverts on failure.
class ShoppingListItemToggled extends ShoppingListEvent {
  const ShoppingListItemToggled(this.itemId);

  final String itemId;

  @override
  List<Object?> get props => [itemId];
}

/// Item removed (swipe/long-press) — optimistic, reverts on failure.
class ShoppingListItemRemoved extends ShoppingListEvent {
  const ShoppingListItemRemoved(this.itemId);

  final String itemId;

  @override
  List<Object?> get props => [itemId];
}
