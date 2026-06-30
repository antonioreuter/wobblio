import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ingestion/usage_summary.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/usage_repository.dart';

/// [IUsageRepository] over the authed [IApiClient] (`GET /me/usage`).
class HttpUsageRepository implements IUsageRepository {
  HttpUsageRepository(this._api);

  final IApiClient _api;

  @override
  Future<UsageSummary> fetch() async {
    final response = await _api.get('/me/usage');
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed /me/usage response', statusCode: 502);
    }
    return UsageSummary(
      used: (data['used'] as num?)?.toInt() ?? 0,
      cap: (data['cap'] as num?)?.toInt(),
      remaining: (data['remaining'] as num?)?.toInt(),
      unlimited: data['unlimited'] == true,
    );
  }
}
