import 'package:equatable/equatable.dart';

/// The Home "inflation pulse" payload (`GET /me/insights/inflation`). Mirrors the
/// backend DTO. [personalInflationPct] is the caller's matched-basket price change
/// over the trailing quarter; it is null (honest empty, never a fabricated 0) when
/// the basket is too small. [regionInflationPct]/[savedBySwitching] are not computed
/// yet server-side — null until those analytics ship, rendered as a "building" state.
class InflationInsight extends Equatable {
  const InflationInsight({
    required this.basketSize,
    this.personalInflationPct,
    this.regionInflationPct,
    this.savedBySwitching,
    this.trend = const [],
  });

  final double? personalInflationPct;
  final int basketSize;
  final double? regionInflationPct;
  final double? savedBySwitching;

  /// 100-based personal-vs-region price index by month, oldest first — the card's sparkline.
  final List<InflationTrendPoint> trend;

  /// True when there's a real personal number to show — the card is hidden otherwise.
  bool get hasPersonal => personalInflationPct != null;

  @override
  List<Object?> get props => [
        personalInflationPct,
        basketSize,
        regionInflationPct,
        savedBySwitching,
        trend,
      ];
}

/// One month on the inflation sparkline: the caller's index and their region's index (either may be
/// null when that month is too thin), both 100-based against the earliest month in the window.
class InflationTrendPoint extends Equatable {
  const InflationTrendPoint({
    required this.period,
    this.personalIndexPct,
    this.regionIndexPct,
  });

  final String period; // 'YYYY-MM'
  final double? personalIndexPct;
  final double? regionIndexPct;

  @override
  List<Object?> get props => [period, personalIndexPct, regionIndexPct];
}
