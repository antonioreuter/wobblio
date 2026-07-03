part of 'notification_bloc.dart';

enum NotificationStatus { loading, ready, empty, failure }

/// Single immutable notifications state. [items] is the live source of
/// truth for read/unread; [hasUnread] drives whether the screen's "Mark all
/// read" affordance is shown at all.
class NotificationState extends Equatable {
  const NotificationState({
    this.status = NotificationStatus.loading,
    this.items = const [],
    this.notice,
  });

  final NotificationStatus status;
  final List<AppNotification> items;
  final String? notice;

  bool get hasUnread => items.any((n) => n.isUnread);

  NotificationState copyWith({
    NotificationStatus? status,
    List<AppNotification>? items,
    // notice is nullable-with-clear, so use an explicit sentinel.
    Object? notice = _unset,
  }) {
    return NotificationState(
      status: status ?? this.status,
      items: items ?? this.items,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props => [status, items, notice];
}

const Object _unset = Object();
