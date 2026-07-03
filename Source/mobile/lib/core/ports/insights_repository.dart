import 'package:wobblio/core/reports/inflation_insight.dart';

/// Port: the Home inflation-pulse insight (`GET /me/insights/inflation`).
/// Concrete adapter (over [IApiClient]) lives in `infrastructure/adapters/`.
abstract class IInsightsRepository {
  Future<InflationInsight> fetchInflation();
}
