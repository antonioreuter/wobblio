import 'package:wobblio/core/ingestion/usage_summary.dart';

/// Port: the signed-in user's weekly upload-credit usage (`GET /me/usage`).
/// Concrete adapter (over [IApiClient]) lives in `infrastructure/adapters/`.
abstract class IUsageRepository {
  Future<UsageSummary> fetch();
}
