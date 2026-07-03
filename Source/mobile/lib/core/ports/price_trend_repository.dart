import 'package:wobblio/core/reports/price_trend_comparison.dart';

/// Port: the Reports screen's price-trend comparison chart (18e) —
/// `GET /price-trends/comparison?products=<id,id,id>&country=&region=`.
/// [countryCode] is ISO 3166-1 alpha-2 uppercase, [regionCode] is ISO 3166-2
/// (e.g. `NL-NB`) — the caller resolves both from [IProfileRepository]
/// before calling. [productIds] is capped at 3 by the caller (the backend
/// 400s above that — see `PriceTrendService.comparison`'s
/// `InvalidTrendQueryError`).
///
/// [PriceTrendComparison.lines] (the public market trend) comes back empty
/// for non-Premium callers — the backend decides this server-side, so there
/// is no client-side 403 to handle here. Concrete adapter lives in
/// `infrastructure/adapters/`.
abstract class IPriceTrendRepository {
  Future<PriceTrendComparison> comparison(
    List<String> productIds,
    String countryCode,
    String regionCode,
  );
}
