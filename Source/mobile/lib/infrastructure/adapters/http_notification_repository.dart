import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/notifications/app_notification.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/notification_repository.dart';

/// [INotificationRepository] over the authed [IApiClient]. Maps the
/// `/notifications...` responses field-for-field — see
/// `specs/mvp/18-mobile-navigation-and-lists/18g-notifications.md` for the
/// backend contract this mirrors.
class HttpNotificationRepository implements INotificationRepository {
  HttpNotificationRepository(this._api);

  final IApiClient _api;

  @override
  Future<List<AppNotification>> list() async {
    final response = await _api.get('/notifications');
    final data = response.data;
    if (data is! Map || data['notifications'] is! List) {
      throw const ApiException('Malformed /notifications response',
          statusCode: 502,);
    }
    return (data['notifications'] as List)
        .whereType<Map<String, dynamic>>()
        .map(_toNotification)
        .toList();
  }

  @override
  Future<void> markRead(String id) async {
    await _api.post('/notifications/$id/read');
  }

  AppNotification _toNotification(Map<String, dynamic> row) => AppNotification(
        id: row['id'] as String,
        kind: (row['kind'] as String?) ?? '',
        title: (row['title'] as String?) ?? '',
        body: (row['body'] as String?) ?? '',
        budgetId: row['budgetId'] as String?,
        readAt: row['readAt'] as String?,
        createdAt: (row['createdAt'] as String?) ?? '',
      );
}
