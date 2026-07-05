import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/shared_split.dart';
import 'package:wobblio/core/splitting/split_allocation.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

/// [ISplitRepository] over the authed [IApiClient]. Maps the
/// `/invoices/{id}/splits...` (and public `/shared-splits/{token}`) responses
/// field-for-field to the domain models — see
/// `specs/mvp/18-mobile-navigation-and-lists/18h-split-bill.md` for the backend
/// contract this mirrors.
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
  Future<List<SplitAllocation>> getSplit(
      String invoiceId, String splitId,) async {
    final response = await _api.get('/invoices/$invoiceId/splits/$splitId');
    final data = response.data;
    if (data is! Map<String, dynamic> || data['allocations'] is! List) {
      throw const ApiException('Malformed split response', statusCode: 502);
    }
    return (data['allocations'] as List)
        .whereType<Map<String, dynamic>>()
        .map(_toAllocation)
        .toList();
  }

  @override
  Future<void> setLineAllocations(
    String invoiceId,
    String splitId,
    String lineId,
    List<LineAllocation> allocations,
  ) async {
    await _api.put(
      '/invoices/$invoiceId/splits/$splitId/lines/$lineId/allocations',
      body: {
        'allocations': [
          for (final a in allocations)
            {'participantName': a.participantName, 'units': a.units},
        ],
      },
    );
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

  @override
  Future<String> createShareLink(String invoiceId, String splitId) async {
    final response =
        await _api.post('/invoices/$invoiceId/splits/$splitId/share');
    final data = response.data;
    if (data is! Map || data['shareUrl'] is! String) {
      throw const ApiException('Malformed share response', statusCode: 502);
    }
    return data['shareUrl'] as String;
  }

  @override
  Future<SharedSplit> getSharedSplit(String token) async {
    final response = await _api.get('/shared-splits/$token');
    final data = response.data;
    if (data is! Map<String, dynamic> || data['participants'] is! List) {
      throw const ApiException('Malformed shared-split response',
          statusCode: 502,);
    }
    return SharedSplit(
      merchant: data['merchant'] as String?,
      date: data['date'] as String?,
      currency: data['currency'] as String?,
      participants: (data['participants'] as List)
          .whereType<Map<String, dynamic>>()
          .map(_toParticipant)
          .toList(),
      grandTotal: (data['grandTotal'] as num?)?.toDouble() ?? 0,
    );
  }

  SplitAllocation _toAllocation(Map<String, dynamic> row) => SplitAllocation(
        lineId: row['lineId'] as String,
        participantName: (row['participantName'] as String?) ?? '',
        units: (row['units'] as num?)?.toDouble() ?? 0,
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
