import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `OPTION 2A`'s screen header block: a small muted [greeting] line above
/// an Outfit [title], left-aligned, with an optional row of trailing [actions]
/// (avatar, icon buttons) and, on pushed screens, a leading back chevron
/// ([onBack]). Replaces the Material `AppBar` across 2a screens — pair it with
/// a `Scaffold(backgroundColor: Colors.transparent)` so the mounted
/// `AuroraBackground` shows through.
class Wobblio2aHeader extends StatelessWidget {
  const Wobblio2aHeader({
    super.key,
    required this.title,
    this.greeting,
    this.actions = const [],
    this.onBack,
  });

  /// Optional muted line above the title (e.g. `"Good evening, Anna"`). Omitted
  /// when there's no name/context to fill it, per `17d`'s "don't invent a
  /// greeting with no name" note.
  final String? greeting;
  final String title;
  final List<Widget> actions;

  /// When set, renders a leading back chevron (pushed screens). Typically
  /// `() => Navigator.of(context).maybePop()`.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.s5, AppSpacing.s4, AppSpacing.s5, AppSpacing.s5,),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (onBack != null) ...[
            HeaderIconButton(
              key: const Key('header-back'),
              icon: LucideIcons.chevron_left,
              tooltip: 'Back',
              onPressed: onBack!,
            ),
            const SizedBox(width: AppSpacing.s3),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (greeting != null) ...[
                  Text(
                    greeting!,
                    style: AppTypography.body(
                        size: AppTypography.textSm,
                        color: AppColors.textMuted,),
                  ),
                  const SizedBox(height: 1),
                ],
                Text(
                  title,
                  style: AppTypography.display(
                      size: 22, weight: FontWeight.w700,),
                ),
              ],
            ),
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(width: AppSpacing.s3),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < actions.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  actions[i],
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A [Wobblio2aHeader] wrapped as a `PreferredSizeWidget` so it can drop into a
/// `Scaffold(appBar:)` slot on pushed/tab screens without restructuring their
/// bodies. Handles the status-bar inset via `SafeArea`; pair with
/// `Scaffold(backgroundColor: Colors.transparent)` so the aurora shows behind
/// it. For a header that scrolls with content (e.g. Home), use
/// [Wobblio2aHeader] directly as a normal child instead.
class WobblioHeaderBar extends StatelessWidget implements PreferredSizeWidget {
  const WobblioHeaderBar({
    super.key,
    required this.title,
    this.greeting,
    this.actions = const [],
    this.onBack,
  });

  final String title;
  final String? greeting;
  final List<Widget> actions;
  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(76);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Wobblio2aHeader(
        title: title,
        greeting: greeting,
        actions: actions,
        onBack: onBack,
      ),
    );
  }
}

/// The 40×40 hairline-bordered square icon button used in `OPTION 2A`'s header
/// (notifications bell, etc.). An optional [showDot] paints the small danger
/// badge the prototype shows for unread notifications.
class HeaderIconButton extends StatelessWidget {
  const HeaderIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.showDot = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    final button = InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(icon, size: 20, color: AppColors.textSecondary),
            if (showDot)
              Positioned(
                top: -1,
                right: -1,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.background, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}
