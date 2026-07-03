import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/notifications/app_notification.dart';
import 'package:wobblio/core/ports/notification_repository.dart';

part 'notification_event.dart';
part 'notification_state.dart';

/// Owns the Notifications screen (18g): loads the caller's notifications and
/// supports optimistic mark-read/mark-all-read, reverting only the item(s)
/// that actually failed against fresh state at failure time — never a stale
/// snapshot captured at handler entry — mirroring
/// `ShoppingListBloc._onItemToggled`'s concurrency-safe revert (flutter_bloc
/// processes events concurrently by default, so a slow failure must not
/// clobber a different, already-succeeded mutation). Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class NotificationBloc extends Bloc<NotificationEvent, NotificationState> {
  NotificationBloc({required INotificationRepository notifications})
      : _notifications = notifications,
        super(const NotificationState()) {
    on<NotificationsStarted>(_onStarted);
    on<NotificationsRefreshed>(_onRefreshed);
    on<NotificationMarkedRead>(_onMarkedRead);
    on<NotificationsMarkAllReadRequested>(_onMarkAllRead);
  }

  final INotificationRepository _notifications;

  Future<void> _onStarted(
    NotificationsStarted event,
    Emitter<NotificationState> emit,
  ) async {
    emit(state.copyWith(status: NotificationStatus.loading));
    await _load(emit);
  }

  Future<void> _onRefreshed(
    NotificationsRefreshed event,
    Emitter<NotificationState> emit,
  ) async {
    await _load(emit);
  }

  Future<void> _load(Emitter<NotificationState> emit) async {
    try {
      final items = await _notifications.list();
      emit(
        state.copyWith(
          status: items.isEmpty
              ? NotificationStatus.empty
              : NotificationStatus.ready,
          items: items,
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: NotificationStatus.failure));
    }
  }

  Future<void> _onMarkedRead(
    NotificationMarkedRead event,
    Emitter<NotificationState> emit,
  ) async {
    final original = _findById(state.items, event.id);
    if (original == null || !original.isUnread) return;
    final now = DateTime.now().toUtc().toIso8601String();
    emit(state.copyWith(
        items: _withReadAt(state.items, {event.id}, now), notice: null,),);
    try {
      await _notifications.markRead(event.id);
    } catch (_) {
      _revertToUnread(
          emit, {event.id}, 'Couldn’t mark that as read — please try again.',);
    }
  }

  Future<void> _onMarkAllRead(
    NotificationsMarkAllReadRequested event,
    Emitter<NotificationState> emit,
  ) async {
    final unreadIds =
        state.items.where((n) => n.isUnread).map((n) => n.id).toSet();
    if (unreadIds.isEmpty) return;
    final now = DateTime.now().toUtc().toIso8601String();
    emit(state.copyWith(
        items: _withReadAt(state.items, unreadIds, now), notice: null,),);

    final failedIds = <String>{};
    await Future.wait(
      unreadIds.map((id) async {
        try {
          await _notifications.markRead(id);
        } catch (_) {
          failedIds.add(id);
        }
      }),
    );
    if (failedIds.isEmpty) return;
    _revertToUnread(
      emit,
      failedIds,
      'Some notifications couldn’t be marked as read — please try again.',
    );
  }

  // Reverts only [ids] against the *current* `state.items` at failure time
  // (not a snapshot captured at handler entry) — see the class doc.
  void _revertToUnread(
      Emitter<NotificationState> emit, Set<String> ids, String notice,) {
    emit(state.copyWith(
        items: _withReadAt(state.items, ids, null), notice: notice,),);
  }

  List<AppNotification> _withReadAt(
          List<AppNotification> items, Set<String> ids, String? readAt,) =>
      [
        for (final n in items)
          if (ids.contains(n.id))
            AppNotification(
              id: n.id,
              kind: n.kind,
              title: n.title,
              body: n.body,
              budgetId: n.budgetId,
              readAt: readAt,
              createdAt: n.createdAt,
            )
          else
            n,
      ];

  AppNotification? _findById(List<AppNotification> items, String id) {
    for (final n in items) {
      if (n.id == id) return n;
    }
    return null;
  }
}
