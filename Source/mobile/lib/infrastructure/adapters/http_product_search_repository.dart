import 'package:wobblio/core/ingestion/product_match.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';

/// [IProductSearchRepository] over the authed [IApiClient] (`GET /products/search?q=`).
class HttpProductSearchRepository implements IProductSearchRepository {
  HttpProductSearchRepository(this._api);

  final IApiClient _api;

  @override
  Future<List<ProductMatch>> search(String query) async {
    final response = await _api.get('/products/search', query: {'q': query});
    final data = response.data;
    if (data is! Map || data['products'] is! List) return const [];
    return (data['products'] as List)
        .whereType<Map<String, dynamic>>()
        .map((p) => ProductMatch(
              productId: p['productId'] as String,
              displayName: (p['displayName'] as String?) ?? '',
              brand: p['brand'] as String?,
            ),)
        .toList();
  }
}
