import 'package:equatable/equatable.dart';

/// One week's median price point on a price-trend line — mirrors the
/// backend's `WeeklyMedianPoint` (`priceTrendRoutes.ts`). Both fields are
/// nullable: `median` null means no observation that week (a chart gap, never
/// coerced to zero); `discountMedian` null means no discounted units that
/// week.
class WeeklyMedianPoint extends Equatable {
  const WeeklyMedianPoint({
    required this.weekStart,
    this.median,
    this.discountMedian,
  });

  /// ISO date, the Monday of the bucket.
  final String weekStart;
  final double? median;
  final double? discountMedian;

  @override
  List<Object?> get props => [weekStart, median, discountMedian];
}

/// One `(product, merchant)` cell of the de-identified public market trend —
/// mirrors the backend's `ServedPriceTrendLine`. Premium-only: the backend
/// serves an empty `lines: []` for STANDARD callers rather than a 403, so
/// there is no forbidden state to model here.
class MarketTrendLine extends Equatable {
  const MarketTrendLine({
    required this.productId,
    required this.merchantId,
    required this.merchantName,
    required this.points,
    required this.observationCount,
    required this.lastObservedOn,
    required this.stale,
    required this.staleDays,
    this.unit,
  });

  final String productId;
  final String merchantId;
  final String merchantName;
  final List<WeeklyMedianPoint> points;
  final int observationCount;
  final String lastObservedOn;
  final bool stale;
  final int staleDays;

  /// `'KG' | 'L' | 'PIECE'` or null when the pack size wasn't detected (the
  /// price is then per-item, not cross-comparable).
  final String? unit;

  @override
  List<Object?> get props => [
        productId,
        merchantId,
        merchantName,
        points,
        observationCount,
        lastObservedOn,
        stale,
        staleDays,
        unit,
      ];
}

/// The caller's own purchase-price history for one product — mirrors the
/// backend's `OwnPurchaseLine`. RLS-scoped, no quorum gate: always served,
/// regardless of role.
class OwnPurchaseLine extends Equatable {
  const OwnPurchaseLine({
    required this.productId,
    required this.points,
    required this.purchaseCount,
    required this.lastPurchasedOn,
    this.unit,
  });

  final String productId;
  final List<WeeklyMedianPoint> points;
  final int purchaseCount;
  final String lastPurchasedOn;
  final String? unit;

  @override
  List<Object?> get props =>
      [productId, points, purchaseCount, lastPurchasedOn, unit];
}

/// `GET /price-trends/comparison` response (18e) — mirrors the backend's
/// `PriceTrendComparison` (`PriceTrendService.ts`) field-for-field.
class PriceTrendComparison extends Equatable {
  const PriceTrendComparison({
    required this.countryCode,
    required this.regionCode,
    required this.weeks,
    required this.lines,
    required this.ownHistory,
  });

  final String countryCode;
  final String regionCode;
  final int weeks;

  /// Public market trend — empty for non-Premium callers.
  final List<MarketTrendLine> lines;

  /// The caller's own purchases — always present.
  final List<OwnPurchaseLine> ownHistory;

  @override
  List<Object?> get props =>
      [countryCode, regionCode, weeks, lines, ownHistory];
}
