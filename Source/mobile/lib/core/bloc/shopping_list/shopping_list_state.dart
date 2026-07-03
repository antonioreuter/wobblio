part of 'shopping_list_bloc.dart';

enum ShoppingListStatus { loading, ready, empty, failure }

/// One row in the (grouped or flat) checklist — merges a live
/// [ShoppingListItem] with its optimizer price/store, when one exists.
class ShoppingListRowView extends Equatable {
  const ShoppingListRowView({
    required this.itemId,
    required this.name,
    required this.quantity,
    required this.checked,
    this.price,
    this.storeName,
  });

  final String itemId;
  final String name;
  final double quantity;
  final bool checked;

  /// Null when the optimizer hasn't run (STANDARD account, or it failed) or
  /// this item has no linked product to price.
  final double? price;
  final String? storeName;

  @override
  List<Object?> get props =>
      [itemId, name, quantity, checked, price, storeName];
}

/// One store's recommended sub-basket, with live checked-state merged in.
class ShoppingListStoreGroup extends Equatable {
  const ShoppingListStoreGroup({
    required this.merchantId,
    required this.name,
    required this.subtotal,
    required this.rows,
  });

  final String merchantId;
  final String name;
  final double subtotal;
  final List<ShoppingListRowView> rows;

  @override
  List<Object?> get props => [merchantId, name, subtotal, rows];
}

/// Single immutable shopping-list state. [list] is the live source of truth
/// for checked/quantity/CRUD; [optimization] (Premium only, may be null on
/// STANDARD accounts or optimizer failure) supplies store grouping + pricing.
/// [storeGroups]/[ungroupedRows] merge the two by `productId` — see
/// `specs/mvp/18-mobile-navigation-and-lists/18c-shopping-list.md`.
class ShoppingListState extends Equatable {
  const ShoppingListState({
    this.status = ShoppingListStatus.loading,
    this.list,
    this.optimization,
    this.isPremium = false,
    this.notice,
  });

  final ShoppingListStatus status;
  final ShoppingListDetail? list;
  final OptimizationResult? optimization;
  final bool isPremium;
  final String? notice;

  /// True once the optimizer ran and found a worthwhile split — the banner
  /// only shows in this case.
  bool get showsSplitRouteBanner => optimization?.optimized == true;

  /// Store-grouped rows, populated only when [optimization] ran and returned
  /// a split. Each [StoreLine] is joined to its live [ShoppingListItem] by
  /// `productId`; a line with no matching live item (e.g. removed since the
  /// optimizer last ran) is skipped rather than shown with no checkbox to
  /// drive. [ShoppingListStoreGroup.subtotal] is summed from the rows that
  /// actually survived that filter — not copied from the optimizer's own
  /// `store.subtotal` snapshot — so it stays correct after a removal instead
  /// of counting a since-deleted item's price.
  List<ShoppingListStoreGroup> get storeGroups {
    final optimization = this.optimization;
    final items = list?.items ?? const <ShoppingListItem>[];
    if (optimization == null || !optimization.optimized) return const [];
    return [
      for (final store in optimization.stores) _storeGroup(store, items),
    ];
  }

  ShoppingListStoreGroup _storeGroup(
      StoreSubList store, List<ShoppingListItem> items,) {
    final rows = [
      for (final line in store.lines)
        if (_findItemByProduct(items, line.productId) case final item?)
          ShoppingListRowView(
            itemId: item.id,
            name: line.displayName,
            quantity: line.quantity,
            checked: item.checked,
            price: line.lineTotal,
            storeName: store.name,
          ),
    ];
    return ShoppingListStoreGroup(
      merchantId: store.merchantId,
      name: store.name,
      subtotal: rows.fold(0.0, (sum, row) => sum + (row.price ?? 0)),
      rows: rows,
    );
  }

  /// Items not covered by [storeGroups]: either the optimizer didn't run
  /// (flat checklist), or these specific items had no linked product /
  /// weren't priced.
  List<ShoppingListRowView> get ungroupedRows {
    final items = list?.items ?? const <ShoppingListItem>[];
    final optimization = this.optimization;
    if (optimization == null || !optimization.optimized) {
      return [for (final item in items) _flatRow(item)];
    }
    final grouped = <String>{
      for (final group in storeGroups)
        for (final row in group.rows) row.itemId,
    };
    return [
      for (final item in items.where((i) => !grouped.contains(i.id)))
        _flatRow(item),
    ];
  }

  double get estimatedTotal {
    final optimization = this.optimization;
    if (optimization == null || !optimization.optimized) return 0;
    var sum = 0.0;
    for (final group in storeGroups) {
      sum += group.subtotal;
    }
    return sum;
  }

  ShoppingListRowView _flatRow(ShoppingListItem item) => ShoppingListRowView(
        itemId: item.id,
        name: item.freeText,
        quantity: item.quantity,
        checked: item.checked,
      );

  static ShoppingListItem? _findItemByProduct(
      List<ShoppingListItem> items, String productId,) {
    for (final item in items) {
      if (item.productId == productId) return item;
    }
    return null;
  }

  ShoppingListState copyWith({
    ShoppingListStatus? status,
    bool? isPremium,
    // list/optimization/notice are nullable-with-clear, so use explicit sentinels.
    Object? list = _unset,
    Object? optimization = _unset,
    Object? notice = _unset,
  }) {
    return ShoppingListState(
      status: status ?? this.status,
      list: list == _unset ? this.list : list as ShoppingListDetail?,
      optimization: optimization == _unset
          ? this.optimization
          : optimization as OptimizationResult?,
      isPremium: isPremium ?? this.isPremium,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props => [status, list, optimization, isPremium, notice];
}

const Object _unset = Object();
