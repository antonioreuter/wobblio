import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/lists/optimization_result.dart';
import 'package:wobblio/core/lists/shopping_list_detail.dart';
import 'package:wobblio/core/lists/shopping_list_summary.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/shopping_list_repository.dart';

/// [IShoppingListRepository] over the authed [IApiClient]. Maps the
/// `/lists...` responses field-for-field to the domain models — see
/// `specs/mvp/18-mobile-navigation-and-lists/18c-shopping-list.md` for the
/// backend contract this mirrors.
class HttpShoppingListRepository implements IShoppingListRepository {
  HttpShoppingListRepository(this._api);

  final IApiClient _api;

  @override
  Future<List<ShoppingListSummary>> list() async {
    final response = await _api.get('/lists');
    final data = response.data;
    if (data is! Map || data['lists'] is! List) {
      throw const ApiException('Malformed /lists response', statusCode: 502);
    }
    return (data['lists'] as List)
        .whereType<Map<String, dynamic>>()
        .map(_toSummary)
        .toList();
  }

  @override
  Future<ShoppingListDetail> getDetail(String listId) async {
    final response = await _api.get('/lists/$listId');
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed list detail response',
          statusCode: 502,);
    }
    return _toDetail(data);
  }

  @override
  Future<String> create(String name, String categoryId) async {
    final response = await _api
        .post('/lists', body: {'name': name, 'categoryId': categoryId});
    final data = response.data;
    if (data is! Map || data['id'] is! String) {
      throw const ApiException('Malformed create-list response',
          statusCode: 502,);
    }
    return data['id'] as String;
  }

  @override
  Future<String> addItem(
    String listId,
    String freeText, {
    String? productId,
    double quantity = 1,
  }) async {
    final response = await _api.post(
      '/lists/$listId/items',
      body: {
        'freeText': freeText,
        if (productId != null) 'productId': productId,
        'quantity': quantity,
      },
    );
    final data = response.data;
    if (data is! Map || data['id'] is! String) {
      throw const ApiException('Malformed add-item response', statusCode: 502);
    }
    return data['id'] as String;
  }

  @override
  Future<void> updateItem(
      String listId, String itemId, ShoppingListItemPatch patch,) async {
    await _api.patch(
      '/lists/$listId/items/$itemId',
      body: {
        if (patch.checked != null) 'checked': patch.checked,
        if (patch.freeText != null) 'freeText': patch.freeText,
        if (patch.quantity != null) 'quantity': patch.quantity,
      },
    );
  }

  @override
  Future<void> removeItem(String listId, String itemId) async {
    await _api.delete('/lists/$listId/items/$itemId');
  }

  @override
  Future<OptimizationResult> optimize(
    String listId, {
    List<String> excludedMerchantIds = const [],
  }) async {
    final response = await _api.post(
      '/lists/$listId/optimize',
      body: {'excludedMerchantIds': excludedMerchantIds},
    );
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed optimize response', statusCode: 502);
    }
    return _toOptimizationResult(data);
  }

  ShoppingListSummary _toSummary(Map<String, dynamic> row) =>
      ShoppingListSummary(
        id: row['id'] as String,
        name: (row['name'] as String?) ?? '',
        categoryId: (row['categoryId'] as String?) ?? '',
        itemCount: (row['itemCount'] as num?)?.toInt() ?? 0,
        createdAt: (row['createdAt'] as String?) ?? '',
      );

  ShoppingListDetail _toDetail(Map<String, dynamic> data) {
    final rawItems = (data['items'] as List?) ?? const [];
    return ShoppingListDetail(
      id: data['id'] as String,
      name: (data['name'] as String?) ?? '',
      categoryId: (data['categoryId'] as String?) ?? '',
      regionCode: data['regionCode'] as String?,
      countryCode: data['countryCode'] as String?,
      isActive: (data['isActive'] as bool?) ?? true,
      createdAt: (data['createdAt'] as String?) ?? '',
      completedAt: data['completedAt'] as String?,
      items: rawItems.whereType<Map<String, dynamic>>().map(_toItem).toList(),
    );
  }

  ShoppingListItem _toItem(Map<String, dynamic> row) => ShoppingListItem(
        id: row['id'] as String,
        freeText: (row['freeText'] as String?) ?? '',
        productId: row['productId'] as String?,
        checked: (row['checked'] as bool?) ?? false,
        quantity: (row['quantity'] as num?)?.toDouble() ?? 1,
        position: (row['position'] as num?)?.toInt() ?? 0,
        updatedAt: (row['updatedAt'] as String?) ?? '',
      );

  OptimizationResult _toOptimizationResult(Map<String, dynamic> data) {
    final rawStores = (data['stores'] as List?) ?? const [];
    final rawBaseline = data['baseline'] as Map<String, dynamic>?;
    final rawUnresolved = (data['unresolvedItems'] as List?) ?? const [];
    return OptimizationResult(
      optimized: (data['optimized'] as bool?) ?? false,
      baseline: rawBaseline == null
          ? null
          : OptimizerBaseline(
              merchantId: rawBaseline['merchantId'] as String,
              name: (rawBaseline['name'] as String?) ?? '',
              total: (rawBaseline['total'] as num?)?.toDouble() ?? 0,
            ),
      totalExpectedSaving:
          (data['totalExpectedSaving'] as num?)?.toDouble() ?? 0,
      stores: rawStores
          .whereType<Map<String, dynamic>>()
          .map(_toStoreSubList)
          .toList(),
      unresolvedItems: rawUnresolved.map((e) => '$e').toList(),
      reason: data['reason'] as String?,
      ownHistoryBasket: ((data['ownHistoryBasket'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map((r) => OwnHistoryBasketTotal(
                merchantId: r['merchantId'] as String,
                name: (r['name'] as String?) ?? '',
                total: (r['total'] as num?)?.toDouble() ?? 0,
                itemsPriced: (r['itemsPriced'] as num?)?.toInt() ?? 0,
              ),)
          .toList(),
    );
  }

  StoreSubList _toStoreSubList(Map<String, dynamic> row) {
    final rawLines = (row['lines'] as List?) ?? const [];
    return StoreSubList(
      merchantId: row['merchantId'] as String,
      name: (row['name'] as String?) ?? '',
      isPrimary: (row['isPrimary'] as bool?) ?? false,
      subtotal: (row['subtotal'] as num?)?.toDouble() ?? 0,
      lines:
          rawLines.whereType<Map<String, dynamic>>().map(_toStoreLine).toList(),
    );
  }

  StoreLine _toStoreLine(Map<String, dynamic> row) => StoreLine(
        productId: row['productId'] as String,
        displayName: (row['displayName'] as String?) ?? '',
        expectedPrice: (row['expectedPrice'] as num?)?.toDouble() ?? 0,
        quantity: (row['quantity'] as num?)?.toDouble() ?? 1,
        lineTotal: (row['lineTotal'] as num?)?.toDouble() ?? 0,
        observationCount: (row['observationCount'] as num?)?.toInt() ?? 0,
        lastObservedOn: row['lastObservedOn'] as String?,
        confidence: (row['confidence'] as String?) ?? 'low',
        reason: row['reason'] as String?,
      );
}
