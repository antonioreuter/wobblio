part of 'notification_bloc.dart';

sealed class NotificationEvent extends Equatable {
  const NotificationEvent();

  @override
  List<Object?> get props => [];
}

/// First load: fetch the caller's active notifications.
class NotificationsStarted extends NotificationEvent {
  const NotificationsStarted();
}

/// Pull-to-refresh: reload the list.
class NotificationsRefreshed extends NotificationEvent {
  const NotificationsRefreshed();
}

/// A card was tapped while unread — optimistically flips `readAt`, reverts
/// only this item on failure.
class NotificationMarkedRead extends NotificationEvent {
  const NotificationMarkedRead(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}

/// "Mark all read" tapped — optimistically flips every currently-unread
/// item, reverts only the ones whose `markRead` call actually failed.
class NotificationsMarkAllReadRequested extends NotificationEvent {
  const NotificationsMarkAllReadRequested();
}
