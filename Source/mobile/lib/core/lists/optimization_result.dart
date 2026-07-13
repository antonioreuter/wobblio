import 'package:equatable/equatable.dart';

/// One priced item within a store's sub-list (`OptimizationResult.stores[].lines`).
/// Keyed by [productId], not the list item's own id — merging this back onto
/// the live `ShoppingListItem` list must join on [productId] (see
/// `specs/mvp/18-mobile-navigation-and-lists/18c-shopping-list.md`).
class StoreLine extends Equatable {
  const StoreLine({
    required this.productId,
    required this.displayName,
    required this.expectedPrice,
    required this.quantity,
    required this.lineTotal,
    required this.observationCount,
    required this.lastObservedOn,
    required this.confidence,
    this.reason,
  });

  final String productId;
  final String displayName;
  final double expectedPrice;
  final double quantity;
  final double lineTotal;
  final int observationCount;
  final String? lastObservedOn; // ISO date
  final String confidence; // 'high' | 'medium' | 'low'
  // 09/05: why this item's comparison-set siblings were considered:
  // 'comparable' | 'watch_only' | 'ambiguous' | 'no_link'. Drives the per-line hint.
  final String? reason;

  @override
  List<Object?> get props => [
        productId,
        displayName,
        expectedPrice,
        quantity,
        lineTotal,
        observationCount,
        lastObservedOn,
        confidence,
        reason,
      ];
}

/// 09/05 zero-usable-links fallback: own-history whole-basket total per merchant, never crowned.
class OwnHistoryBasketTotal extends Equatable {
  const OwnHistoryBasketTotal({
    required this.merchantId,
    required this.name,
    required this.total,
    required this.itemsPriced,
  });

  final String merchantId;
  final String name;
  final double total;
  final int itemsPriced;

  @override
  List<Object?> get props => [merchantId, name, total, itemsPriced];
}

/// One store's recommended sub-basket.
class StoreSubList extends Equatable {
  const StoreSubList({
    required this.merchantId,
    required this.name,
    required this.isPrimary,
    required this.subtotal,
    required this.lines,
  });

  final String merchantId;
  final String name;
  final bool isPrimary;
  final double subtotal;
  final List<StoreLine> lines;

  @override
  List<Object?> get props => [merchantId, name, isPrimary, subtotal, lines];
}

/// The single-store baseline `OptimizationResult` compares against.
class OptimizerBaseline extends Equatable {
  const OptimizerBaseline(
      {required this.merchantId, required this.name, required this.total,});

  final String merchantId;
  final String name;
  final double total;

  @override
  List<Object?> get props => [merchantId, name, total];
}

/// Result of `POST /lists/{id}/optimize` (Premium-gated — a 403 for STANDARD
/// users surfaces as an [ApiException], not this type; see [ShoppingListBloc]).
class OptimizationResult extends Equatable {
  const OptimizationResult({
    required this.optimized,
    required this.baseline,
    required this.totalExpectedSaving,
    required this.stores,
    required this.unresolvedItems,
    required this.reason,
    this.ownHistoryBasket = const [],
  });

  final bool optimized;
  final OptimizerBaseline? baseline;
  final double totalExpectedSaving;
  final List<StoreSubList> stores;

  /// Free-text list items with no linked product — not priced or
  /// store-grouped by the optimizer.
  final List<String> unresolvedItems;
  final String? reason;

  /// 09/05 zero-usable-links fallback: own-history per-merchant basket totals (empty otherwise).
  final List<OwnHistoryBasketTotal> ownHistoryBasket;

  @override
  List<Object?> get props => [
        optimized,
        baseline,
        totalExpectedSaving,
        stores,
        unresolvedItems,
        reason,
        ownHistoryBasket,
      ];
}
