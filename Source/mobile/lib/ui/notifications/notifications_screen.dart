import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/notifications/notification_bloc.dart';
import 'package:wobblio/core/notifications/app_notification.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';

/// Notifications screen (18g): "Mark all read" (hidden once nothing is
/// unread) and a list of budget-alert cards — tapping an unread card marks
/// it read. See `specs/mvp/18-mobile-navigation-and-lists/18g-notifications.md`.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<NotificationBloc>(
      create: (_) =>
          locator<NotificationBloc>()..add(const NotificationsStarted()),
      child: const _NotificationsView(),
    );
  }
}

class _NotificationsView extends StatelessWidget {
  const _NotificationsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('notifications-screen'),
      appBar: AppBar(title: const Text('Notifications')),
      body: SafeArea(
        child: BlocConsumer<NotificationBloc, NotificationState>(
          listenWhen: (prev, curr) =>
              curr.notice != null && prev.notice != curr.notice,
          listener: (context, state) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          },
          builder: (context, state) {
            if (state.status == NotificationStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == NotificationStatus.failure) {
              return _RetryMessage(
                onRetry: () => context
                    .read<NotificationBloc>()
                    .add(const NotificationsStarted()),
              );
            }
            if (state.status == NotificationStatus.empty) {
              return const _EmptyState();
            }
            return RefreshIndicator(
              onRefresh: () async => context
                  .read<NotificationBloc>()
                  .add(const NotificationsRefreshed()),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    sliver: SliverToBoxAdapter(
                        child: _Header(hasUnread: state.hasUnread),),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList.separated(
                      itemCount: state.items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) =>
                          _NotificationCard(notification: state.items[i]),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.hasUnread});

  final bool hasUnread;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text('Notifications',
              style: AppTypography.display(size: AppTypography.text2xl),),
        ),
        if (hasUnread)
          TextButton(
            key: const Key('notifications-mark-all-read'),
            onPressed: () => context
                .read<NotificationBloc>()
                .add(const NotificationsMarkAllReadRequested()),
            child: const Text('Mark all read'),
          ),
      ],
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification});

  final AppNotification notification;

  @override
  Widget build(BuildContext context) {
    final tone = _toneFor(notification.kind);
    return GestureDetector(
      key: Key('notification-${notification.id}'),
      onTap: notification.isUnread
          ? () => context
              .read<NotificationBloc>()
              .add(NotificationMarkedRead(notification.id))
          : null,
      child: GlassContainer(
        padding: const EdgeInsets.all(15),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: tone.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: Icon(_iconFor(notification.kind), size: 20, color: tone),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: AppTypography.body(
                              size: AppTypography.textMd,
                              weight: FontWeight.w700,),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatRelativeTime(notification.createdAt),
                        style: AppTypography.body(
                            size: AppTypography.textXs,
                            color: AppColors.textMuted,),
                      ),
                      if (notification.isUnread) ...[
                        const SizedBox(width: 6),
                        Container(
                          key: const Key('notification-unread-dot'),
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: const BoxDecoration(
                              color: AppColors.brand, shape: BoxShape.circle,),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: AppTypography.body(
                        size: AppTypography.textSm,
                        color: AppColors.textSecondary,),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static IconData _iconFor(String kind) => switch (kind) {
        'BUDGET_100' => Icons.error_outline,
        'BUDGET_85' => Icons.warning_amber_outlined,
        _ => Icons.info_outline,
      };

  static Color _toneFor(String kind) => switch (kind) {
        'BUDGET_100' => AppColors.danger,
        'BUDGET_85' => AppColors.warning,
        _ => AppColors.brand,
      };
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.notifications_none,
                size: 48, color: AppColors.brand,),
            const SizedBox(height: 16),
            Text('No notifications yet',
                style: AppTypography.body(size: AppTypography.textMd),),
          ],
        ),
      ),
    );
  }
}

class _RetryMessage extends StatelessWidget {
  const _RetryMessage({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Couldn’t load your notifications',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
