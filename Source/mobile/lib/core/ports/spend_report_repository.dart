import 'package:wobblio/core/reports/spend_breakdown.dart';

/// The report time window. Mobile ships the three presets; the custom range
/// (and arbitrary-region picking) stays a web-first "deep analysis" feature.
enum SpendPeriod { thisWeek, thisMonth, last90d }

String spendPeriodToWire(SpendPeriod period) {
  switch (period) {
    case SpendPeriod.thisWeek:
      return 'THIS_WEEK';
    case SpendPeriod.thisMonth:
      return 'THIS_MONTH';
    case SpendPeriod.last90d:
      return 'LAST_90D';
  }
}

/// The drill selection + filters for one `GET /reports/spend` call. Which level
/// the backend returns is inferred from which of the id fields are set.
class SpendQuery {
  const SpendQuery({
    required this.period,
    this.country = '',
    this.region = '', // '' ⇒ all regions
    this.categoryId,
    this.merchantId,
    this.itemCategoryId,
  });

  final SpendPeriod period;
  final String country;
  final String region;
  final String? categoryId;
  final String? merchantId;
  final String? itemCategoryId;

  Map<String, dynamic> toQuery() {
    final map = <String, dynamic>{'period': spendPeriodToWire(period)};
    if (region.isNotEmpty) {
      map['country'] = country;
      map['region'] = region;
    }
    if (categoryId != null) map['categoryId'] = categoryId;
    if (merchantId != null) map['merchantId'] = merchantId;
    if (itemCategoryId != null) map['itemCategoryId'] = itemCategoryId;
    return map;
  }
}

/// Port: the hierarchical spend-breakdown report. Concrete adapter (over
/// [IApiClient]) lives in `infrastructure/adapters/`. Throws [ApiException]
/// (statusCode 403) when a STANDARD caller requests an item-level drill.
abstract class ISpendReportRepository {
  Future<SpendBreakdown> fetch(SpendQuery query);
}
