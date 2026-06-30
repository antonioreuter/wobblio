import 'package:wobblio/core/ingestion/product_match.dart';

/// Port: product autocomplete for the line bottom sheet (`GET /products/search`).
/// Concrete adapter (over [IApiClient]) lives in `infrastructure/adapters/`.
abstract class IProductSearchRepository {
  Future<List<ProductMatch>> search(String query);
}
