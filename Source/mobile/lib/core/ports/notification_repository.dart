import 'package:wobblio/core/notifications/app_notification.dart';

/// Port: the caller's own in-app notifications (18g).
///
/// [list] → `GET /notifications` (RLS-scoped, non-expired/active only —
/// already-read notifications past their TTL are pruned server-side).
/// [markRead] → `POST /notifications/{id}/read`. Concrete adapter lives in
/// `infrastructure/adapters/`.
abstract class INotificationRepository {
  Future<List<AppNotification>> list();

  Future<void> markRead(String id);
}
