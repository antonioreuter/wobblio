import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/split_assignment.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

/// [ISplitRepository] over the authed [IApiClient]. Maps the
/// `/invoices/{id}/splits...` responses field-for-field to the domain
/// models — see `specs/mvp/18-mobile-navigation-and-lists/18h-split-bill.md`
/// for the backend contract this mirrors.
class HttpSplitRepository implements ISplitRepository {
  HttpSplitRepository(this._api);

  final IApiClient _api;

  @override
  Future<String> createSplit(String invoiceId) async {
    final response = await _api.post('/invoices/$invoiceId/splits');
    final data = response.data;
    if (data is! Map || data['splitId'] is! String) {
      throw const ApiException('Malformed create-split response',
          statusCode: 502,);
    }
    return data['splitId'] as String;
  }

  @override
  Future<List<SplitAssignment>> getSplit(
      String invoiceId, String splitId,) async {
    final response = await _api.get('/invoices/$invoiceId/splits/$splitId');
    final data = response.data;
    if (data is! Map<String, dynamic> || data['assignments'] is! List) {
      throw const ApiException('Malformed split response', statusCode: 502);
    }
    return (data['assignments'] as List)
        .whereType<Map<String, dynamic>>()
        .map(_toAssignment)
        .toList();
  }

  @override
  Future<void> assignLine(
    String invoiceId,
    String splitId,
    String lineId,
    String participantName, {
    double fraction = 1,
  }) async {
    await _api.patch(
      '/invoices/$invoiceId/splits/$splitId/lines/$lineId',
      body: {'participantName': participantName, 'fraction': fraction},
    );
  }

  @override
  Future<void> unassignLine(
      String invoiceId, String splitId, String lineId,) async {
    await _api.delete(
        '/invoices/$invoiceId/splits/$splitId/lines/$lineId/assignment',);
  }

  @override
  Future<SplitSummary> getSummary(String invoiceId, String splitId) async {
    final response =
        await _api.get('/invoices/$invoiceId/splits/$splitId/summary');
    final data = response.data;
    if (data is! Map<String, dynamic> || data['participants'] is! List) {
      throw const ApiException('Malformed split summary response',
          statusCode: 502,);
    }
    return _toSummary(data);
  }

  @override
  Future<String> getWhatsAppText(String invoiceId, String splitId) async {
    final response =
        await _api.get('/invoices/$invoiceId/splits/$splitId/whatsapp');
    final data = response.data;
    if (data is! Map || data['text'] is! String) {
      throw const ApiException('Malformed whatsapp response',
          statusCode: 502,);
    }
    return data['text'] as String;
  }

  SplitAssignment _toAssignment(Map<String, dynamic> row) => SplitAssignment(
        lineId: row['lineId'] as String,
        participantName: (row['participantName'] as String?) ?? '',
        fraction: (row['fraction'] as num?)?.toDouble() ?? 1,
      );

  SplitSummary _toSummary(Map<String, dynamic> data) {
    final rawParticipants = (data['participants'] as List?) ?? const [];
    return SplitSummary(
      participants: rawParticipants
          .whereType<Map<String, dynamic>>()
          .map(_toParticipant)
          .toList(),
      grandTotal: (data['grandTotal'] as num?)?.toDouble() ?? 0,
    );
  }

  SplitParticipant _toParticipant(Map<String, dynamic> row) {
    final rawItems = (row['items'] as List?) ?? const [];
    return SplitParticipant(
      name: (row['name'] as String?) ?? '',
      subtotal: (row['subtotal'] as num?)?.toDouble() ?? 0,
      fees: (row['fees'] as num?)?.toDouble() ?? 0,
      total: (row['total'] as num?)?.toDouble() ?? 0,
      items:
          rawItems.whereType<Map<String, dynamic>>().map(_toItem).toList(),
    );
  }

  SplitItem _toItem(Map<String, dynamic> row) => SplitItem(
        lineId: row['lineId'] as String,
        label: (row['label'] as String?) ?? '',
        qty: (row['qty'] as num?)?.toDouble() ?? 1,
        fraction: (row['fraction'] as num?)?.toDouble() ?? 1,
        amount: (row['amount'] as num?)?.toDouble() ?? 0,
      );
}
