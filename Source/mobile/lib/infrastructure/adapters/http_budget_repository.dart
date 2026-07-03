import 'package:wobblio/core/budgets/budget.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/budget_repository.dart';

/// [IBudgetRepository] over the authed [IApiClient]. Maps the `/budgets...`
/// responses field-for-field to the domain model — see
/// `specs/mvp/18-mobile-navigation-and-lists/18d-budgets.md` for the backend
/// contract this mirrors.
class HttpBudgetRepository implements IBudgetRepository {
  HttpBudgetRepository(this._api);

  final IApiClient _api;

  @override
  Future<List<Budget>> list() async {
    final response = await _api.get('/budgets');
    final data = response.data;
    if (data is! Map || data['budgets'] is! List) {
      throw const ApiException('Malformed /budgets response', statusCode: 502);
    }
    return (data['budgets'] as List)
        .whereType<Map<String, dynamic>>()
        .map(_toBudget)
        .toList();
  }

  @override
  Future<Budget> create(NewBudget budget) async {
    final response = await _api.post(
      '/budgets',
      body: {
        'scope': budget.scope,
        'categoryId': budget.categoryId,
        'memberUserId': budget.memberUserId,
        'amount': budget.amount,
        'period': budget.period,
      },
    );
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed create-budget response',
          statusCode: 502,);
    }
    return _toBudget(data);
  }

  @override
  Future<void> update(String id, BudgetPatch patch) async {
    await _api.patch(
      '/budgets/$id',
      body: {
        if (patch.amount != null) 'amount': patch.amount,
        if (patch.period != null) 'period': patch.period,
      },
    );
  }

  @override
  Future<void> remove(String id) async {
    await _api.delete('/budgets/$id');
  }

  Budget _toBudget(Map<String, dynamic> row) => Budget(
        id: row['id'] as String,
        scope: (row['scope'] as String?) ?? 'TOTAL',
        categoryId: row['categoryId'] as String?,
        memberUserId: row['memberUserId'] as String?,
        amount: (row['amount'] as num?)?.toDouble() ?? 0,
        period: (row['period'] as String?) ?? 'MONTH',
        accumulated: (row['accumulated'] as num?)?.toDouble() ?? 0,
        alert85Fired: (row['alert85Fired'] as bool?) ?? false,
        alert100Fired: (row['alert100Fired'] as bool?) ?? false,
        alert85At: row['alert85At'] as String?,
        alert100At: row['alert100At'] as String?,
        cycleStart: (row['cycleStart'] as String?) ?? '',
      );
}
