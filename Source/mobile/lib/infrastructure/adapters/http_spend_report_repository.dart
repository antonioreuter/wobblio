import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/spend_report_repository.dart';
import 'package:wobblio/core/reports/spend_breakdown.dart';

/// [ISpendReportRepository] over the authed [IApiClient] (`GET /reports/spend`).
/// The backend enforces the 90-day cap and the premium item-level gate; a 403
/// surfaces here as an [ApiException] the bloc maps to its forbidden state.
class HttpSpendReportRepository implements ISpendReportRepository {
  HttpSpendReportRepository(this._api);

  final IApiClient _api;

  @override
  Future<SpendBreakdown> fetch(SpendQuery query) async {
    final response = await _api.get('/reports/spend', query: query.toQuery());
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed /reports/spend response',
          statusCode: 502,);
    }
    return SpendBreakdown(
      level: spendLevelFromWire(data['level'] as String?),
      currency: data['currency'] as String?,
      total: _toDouble(data['total']),
      nodes: _parseNodes(data['nodes']),
      categoryId: data['categoryId'] as String?,
      categoryName: data['categoryName'] as String?,
      merchantId: data['merchantId'] as String?,
      merchantName: data['merchantName'] as String?,
      itemCategoryId: data['itemCategoryId'] as String?,
      itemCategoryName: data['itemCategoryName'] as String?,
    );
  }

  List<SpendNode> _parseNodes(Object? raw) {
    if (raw is! List) return const [];
    return raw.whereType<Map<String, dynamic>>().map((n) {
      return SpendNode(
        id: n['id'] as String? ?? '',
        name: n['name'] as String? ?? '',
        amount: _toDouble(n['amount']),
        pct: _toDouble(n['pct']),
        count: (n['count'] as num?)?.toInt() ?? 0,
        invoiceCount: (n['invoiceCount'] as num?)?.toInt(),
        lastPurchasedOn: n['lastPurchasedOn'] as String?,
        quantity: n['quantity'] == null ? null : _toDouble(n['quantity']),
        occurrences: _parseOccurrences(n['occurrences']),
      );
    }).toList();
  }

  List<SpendOccurrence> _parseOccurrences(Object? raw) {
    if (raw is! List) return const [];
    return raw.whereType<Map<String, dynamic>>().map((o) {
      return SpendOccurrence(
        date: o['date'] as String? ?? '',
        invoiceId: o['invoiceId'] as String? ?? '',
        quantity: _toDouble(o['quantity']),
        amount: _toDouble(o['amount']),
      );
    }).toList();
  }

  static double _toDouble(Object? value) => (value as num?)?.toDouble() ?? 0;
}
