import 'package:equatable/equatable.dart';

/// One in-app notification (`GET /notifications` → `NotificationView`).
///
/// `kind` is a free-form string set by the backend — currently `BUDGET_85` /
/// `BUDGET_100` (see `AlertKind` in `Source/backend/src/core/domain/budget.ts`)
/// but more may land later. The UI maps known kinds to a tone/icon and falls
/// back to a generic one rather than switching exhaustively on it, so an
/// unrecognized future kind still renders sensibly instead of crashing.
class AppNotification extends Equatable {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    required this.budgetId,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String kind;
  final String title;
  final String body;
  final String? budgetId;
  final String? readAt; // ISO timestamp, null while unread
  final String createdAt; // ISO timestamp

  bool get isUnread => readAt == null;

  @override
  List<Object?> get props =>
      [id, kind, title, body, budgetId, readAt, createdAt];
}
