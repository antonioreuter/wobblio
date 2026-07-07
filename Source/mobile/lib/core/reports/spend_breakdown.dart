import 'package:equatable/equatable.dart';

/// The four drill levels of the spend-breakdown report (`GET /reports/spend`).
enum SpendLevel { categories, merchants, itemCategories, items }

SpendLevel spendLevelFromWire(String? raw) {
  switch (raw) {
    case 'merchants':
      return SpendLevel.merchants;
    case 'item-categories':
      return SpendLevel.itemCategories;
    case 'items':
      return SpendLevel.items;
    default:
      return SpendLevel.categories;
  }
}

/// One occurrence of an item within an L4 group (same product across trips).
class SpendOccurrence extends Equatable {
  const SpendOccurrence({
    required this.date,
    required this.invoiceId,
    required this.quantity,
    required this.amount,
  });

  final String date;
  final String invoiceId;
  final double quantity;
  final double amount;

  @override
  List<Object?> get props => [date, invoiceId, quantity, amount];
}

/// A single row at any drill level. [amount] is home-currency and signed
/// (discounts net negative); [pct] is the share of the level total.
class SpendNode extends Equatable {
  const SpendNode({
    required this.id,
    required this.name,
    required this.amount,
    required this.pct,
    required this.count,
    this.invoiceCount,
    this.lastPurchasedOn,
    this.quantity,
    this.occurrences = const [],
  });

  final String id;
  final String name;
  final double amount;
  final double pct;
  final int count;
  final int? invoiceCount;
  final String? lastPurchasedOn;
  final double? quantity;
  final List<SpendOccurrence> occurrences;

  @override
  List<Object?> get props => [
        id,
        name,
        amount,
        pct,
        count,
        invoiceCount,
        lastPurchasedOn,
        quantity,
        occurrences,
      ];
}

/// The report for one drill level: the nodes plus the echoed drill context
/// (names) so the screen can render a breadcrumb without re-deriving them.
class SpendBreakdown extends Equatable {
  const SpendBreakdown({
    required this.level,
    required this.currency,
    required this.total,
    required this.nodes,
    this.categoryId,
    this.categoryName,
    this.merchantId,
    this.merchantName,
    this.itemCategoryId,
    this.itemCategoryName,
  });

  final SpendLevel level;
  final String? currency;
  final double total;
  final List<SpendNode> nodes;
  final String? categoryId;
  final String? categoryName;
  final String? merchantId;
  final String? merchantName;
  final String? itemCategoryId;
  final String? itemCategoryName;

  @override
  List<Object?> get props => [
        level,
        currency,
        total,
        nodes,
        categoryId,
        categoryName,
        merchantId,
        merchantName,
        itemCategoryId,
        itemCategoryName,
      ];
}
