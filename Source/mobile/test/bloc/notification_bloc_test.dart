import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/notifications/notification_bloc.dart';
import 'package:wobblio/core/notifications/app_notification.dart';
import 'package:wobblio/core/ports/notification_repository.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
AppNotification _n(
  String id, {
  String kind = 'BUDGET_85',
  String? readAt,
  String createdAt = '2026-07-01T00:00:00Z',
}) =>
    AppNotification(
      id: id,
      kind: kind,
      title: 'Title $id',
      body: 'Body $id',
      budgetId: null,
      readAt: readAt,
      createdAt: createdAt,
    );

// ── Hand-rolled fake ──────────────────────────────────────────────────────────
class _FakeNotifications implements INotificationRepository {
  _FakeNotifications({
    List<AppNotification>? items,
    this.failList = false,
    this.failMarkReadForIds = const {},
    this.markReadDelayForId = const {},
  }) : _items = items ?? [_n('n1'), _n('n2')];

  final List<AppNotification> _items;
  final bool failList;
  final Set<String> failMarkReadForIds;
  final Map<String, Duration> markReadDelayForId;
  final List<String> markedRead = [];

  @override
  Future<List<AppNotification>> list() async {
    if (failList) throw Exception('boom');
    return _items;
  }

  @override
  Future<void> markRead(String id) async {
    markedRead.add(id);
    final delay = markReadDelayForId[id];
    if (delay != null) await Future<void>.delayed(delay);
    if (failMarkReadForIds.contains(id)) throw Exception('boom');
  }
}

void main() {
  group('NotificationBloc', () {
    blocTest<NotificationBloc, NotificationState>(
      'loaded notifications → ready status',
      build: () => NotificationBloc(notifications: _FakeNotifications()),
      act: (bloc) => bloc.add(const NotificationsStarted()),
      skip: 1,
      expect: () => [
        isA<NotificationState>()
            .having((s) => s.status, 'status', NotificationStatus.ready)
            .having((s) => s.items.length, 'items.length', 2)
            .having((s) => s.hasUnread, 'hasUnread', isTrue),
      ],
    );

    blocTest<NotificationBloc, NotificationState>(
      'empty list() → empty status',
      build: () => NotificationBloc(notifications: _FakeNotifications(items: [])),
      act: (bloc) => bloc.add(const NotificationsStarted()),
      skip: 1,
      expect: () => [
        isA<NotificationState>().having((s) => s.status, 'status', NotificationStatus.empty),
      ],
    );

    blocTest<NotificationBloc, NotificationState>(
      'list() failure → failure status',
      build: () => NotificationBloc(notifications: _FakeNotifications(failList: true)),
      act: (bloc) => bloc.add(const NotificationsStarted()),
      skip: 1,
      expect: () => [
        isA<NotificationState>().having((s) => s.status, 'status', NotificationStatus.failure),
      ],
    );

    blocTest<NotificationBloc, NotificationState>(
      'marking a notification read is optimistic',
      build: () => NotificationBloc(notifications: _FakeNotifications()),
      act: (bloc) async {
        bloc.add(const NotificationsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const NotificationMarkedRead('n1'));
      },
      skip: 1,
      verify: (bloc) {
        final n1 = bloc.state.items.firstWhere((n) => n.id == 'n1');
        expect(n1.isUnread, isFalse);
      },
    );

    test(
      'a slow-failing mark-read reverts only its own item, not a concurrent, '
      'already-succeeded mark-read of a different item',
      () async {
        // flutter_bloc processes events concurrently by default — n1's
        // mark-read fails after n2's mark-read has already succeeded. The
        // revert must not clobber n2.
        final notifications = _FakeNotifications(
          failMarkReadForIds: {'n1'},
          markReadDelayForId: {'n1': const Duration(milliseconds: 20)},
        );
        final bloc = NotificationBloc(notifications: notifications);
        bloc.add(const NotificationsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const NotificationMarkedRead('n1')); // slow, will fail
        await Future<void>.delayed(Duration.zero);
        bloc.add(const NotificationMarkedRead('n2')); // fast, succeeds
        await Future<void>.delayed(const Duration(milliseconds: 40));

        final n1 = bloc.state.items.firstWhere((n) => n.id == 'n1');
        final n2 = bloc.state.items.firstWhere((n) => n.id == 'n2');
        expect(n1.isUnread, isTrue, reason: 'n1 must revert to unread');
        expect(n2.isUnread, isFalse, reason: 'n2 must stay read');
        await bloc.close();
      },
    );

    test('mark-all-read marks every unread item', () async {
      final bloc = NotificationBloc(notifications: _FakeNotifications());
      bloc.add(const NotificationsStarted());
      await Future<void>.delayed(Duration.zero);
      bloc.add(const NotificationsMarkAllReadRequested());
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(bloc.state.items.every((n) => !n.isUnread), isTrue);
      expect(bloc.state.hasUnread, isFalse);
      await bloc.close();
    });

    test('mark-all-read partial failure reverts only the failed items', () async {
      final notifications = _FakeNotifications(
        items: [_n('n1'), _n('n2'), _n('n3')],
        failMarkReadForIds: {'n2'},
      );
      final bloc = NotificationBloc(notifications: notifications);
      bloc.add(const NotificationsStarted());
      await Future<void>.delayed(Duration.zero);
      bloc.add(const NotificationsMarkAllReadRequested());
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(bloc.state.items.firstWhere((n) => n.id == 'n1').isUnread, isFalse);
      expect(bloc.state.items.firstWhere((n) => n.id == 'n2').isUnread, isTrue);
      expect(bloc.state.items.firstWhere((n) => n.id == 'n3').isUnread, isFalse);
      expect(bloc.state.notice, isNotNull);
      await bloc.close();
    });

    test('mark-all-read is a no-op when nothing is unread', () async {
      final notifications = _FakeNotifications(items: [_n('n1', readAt: '2026-07-01T01:00:00Z')]);
      final bloc = NotificationBloc(notifications: notifications);
      bloc.add(const NotificationsStarted());
      await Future<void>.delayed(Duration.zero);
      bloc.add(const NotificationsMarkAllReadRequested());
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(notifications.markedRead, isEmpty);
      await bloc.close();
    });
  });
}
