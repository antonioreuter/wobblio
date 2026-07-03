import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/reference_repository.dart';
import 'package:wobblio/core/reference/category.dart';

/// [IReferenceRepository] over the authed [IApiClient]. Maps
/// `GET /reference/categories`'s `{categories: [{id, name, parentId}]}` to the
/// domain model — see `Source/backend/src/core/domain/categoryTaxonomy.ts`.
class HttpReferenceRepository implements IReferenceRepository {
  HttpReferenceRepository(this._api);

  final IApiClient _api;

  @override
  Future<List<Category>> fetchCategories() async {
    final response = await _api.get('/reference/categories');
    final data = response.data;
    if (data is! Map || data['categories'] is! List) {
      throw const ApiException('Malformed /reference/categories response',
          statusCode: 502,);
    }
    return (data['categories'] as List)
        .whereType<Map<String, dynamic>>()
        .map((row) => Category(
            id: row['id'] as String, name: (row['name'] as String?) ?? '',),)
        .toList();
  }
}
