import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/price_trend_repository.dart';
import 'package:wobblio/core/reports/price_trend_comparison.dart';

/// [IPriceTrendRepository] over the authed [IApiClient]. Maps
/// `GET /price-trends/comparison`'s response field-for-field to the domain
/// models — see `Source/backend/src/core/services/data-intelligence/PriceTrendService.ts`
/// for the backend contract this mirrors.
class HttpPriceTrendRepository implements IPriceTrendRepository {
  HttpPriceTrendRepository(this._api);

  final IApiClient _api;

  @override
  Future<PriceTrendComparison> comparison(
    List<String> productIds,
    String countryCode,
    String regionCode,
  ) async {
    final response = await _api.get(
      '/price-trends/comparison',
      query: {
        'products': productIds.join(','),
        'country': countryCode,
        'region': regionCode,
      },
    );
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException(
        'Malformed /price-trends/comparison response',
        statusCode: 502,
      );
    }
    return _toComparison(data);
  }

  PriceTrendComparison _toComparison(Map<String, dynamic> data) {
    final rawLines = (data['lines'] as List?) ?? const [];
    final rawOwn = (data['ownHistory'] as List?) ?? const [];
    return PriceTrendComparison(
      countryCode: (data['countryCode'] as String?) ?? '',
      regionCode: (data['regionCode'] as String?) ?? '',
      weeks: (data['weeks'] as num?)?.toInt() ?? 0,
      lines: rawLines
          .whereType<Map<String, dynamic>>()
          .map(_toMarketLine)
          .toList(),
      ownHistory:
          rawOwn.whereType<Map<String, dynamic>>().map(_toOwnLine).toList(),
    );
  }

  MarketTrendLine _toMarketLine(Map<String, dynamic> row) => MarketTrendLine(
        productId: row['productId'] as String,
        merchantId: (row['merchantId'] as String?) ?? '',
        merchantName: (row['merchantName'] as String?) ?? '',
        points: _toPoints(row['points']),
        observationCount: (row['observationCount'] as num?)?.toInt() ?? 0,
        lastObservedOn: (row['lastObservedOn'] as String?) ?? '',
        stale: (row['stale'] as bool?) ?? false,
        staleDays: (row['staleDays'] as num?)?.toInt() ?? 0,
        unit: row['unit'] as String?,
      );

  OwnPurchaseLine _toOwnLine(Map<String, dynamic> row) => OwnPurchaseLine(
        productId: row['productId'] as String,
        points: _toPoints(row['points']),
        purchaseCount: (row['purchaseCount'] as num?)?.toInt() ?? 0,
        lastPurchasedOn: (row['lastPurchasedOn'] as String?) ?? '',
        unit: row['unit'] as String?,
      );

  List<WeeklyMedianPoint> _toPoints(Object? raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(
          (p) => WeeklyMedianPoint(
            weekStart: (p['weekStart'] as String?) ?? '',
            median: (p['median'] as num?)?.toDouble(),
            discountMedian: (p['discountMedian'] as num?)?.toDouble(),
          ),
        )
        .toList();
  }
}
