import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/insights_repository.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';

/// [IInsightsRepository] over the authed [IApiClient] (`GET /me/insights/inflation`).
class HttpInsightsRepository implements IInsightsRepository {
  HttpInsightsRepository(this._api);

  final IApiClient _api;

  @override
  Future<InflationInsight> fetchInflation() async {
    final response = await _api.get('/me/insights/inflation');
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException(
          'Malformed /me/insights/inflation response', statusCode: 502,);
    }
    return InflationInsight(
      personalInflationPct: (data['personalInflationPct'] as num?)?.toDouble(),
      basketSize: (data['basketSize'] as num?)?.toInt() ?? 0,
      regionInflationPct: (data['regionInflationPct'] as num?)?.toDouble(),
      savedBySwitching: (data['savedBySwitching'] as num?)?.toDouble(),
    );
  }
}
