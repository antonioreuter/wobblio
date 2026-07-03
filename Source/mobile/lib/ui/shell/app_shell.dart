import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

import 'package:wobblio/ui/capture/capture_screen.dart';
import 'package:wobblio/ui/dashboard/dashboard_screen.dart';
import 'package:wobblio/ui/design_system/wobblio_nav_bar.dart';
import 'package:wobblio/ui/history/history_screen.dart';
import 'package:wobblio/ui/reports/reports_screen.dart';
import 'package:wobblio/ui/shopping_list/shopping_list_screen.dart';

/// Authenticated home (18a, re-skinned to `OPTION 2A` in 19a): a bottom-tab
/// shell over Home / Receipts / Shopping / Reports, plus a Capture entry that
/// pushes [CaptureScreen] directly rather than living in the [IndexedStack].
/// The chrome is now the prototype's floating glass [WobblioNavBar] (a raised
/// gradient capture FAB spliced into the middle) overlaid on `extendBody`
/// content so the mounted `AuroraBackground` shows through. Each tab keeps
/// owning its own inner `Scaffold` exactly as [DashboardScreen] already does.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  // Bumped after a capture completes via the nav-bar Scan button, to force
  // Dashboard/History to remount (fresh BLoC, fresh fetch) — DashboardScreen's
  // own FAB refreshes its bloc directly via a DashboardRefreshed event, but
  // AppShell holds no reference to either screen's screen-scoped bloc (each
  // tab owns its own, per 18a), so a full remount is the mechanism available
  // here without lifting bloc ownership up into the shell.
  int _dashboardKeySalt = 0;
  int _historyKeySalt = 0;

  List<Widget> get _tabs => [
        DashboardScreen(key: ValueKey('dashboard-$_dashboardKeySalt')),
        HistoryScreen(key: ValueKey('history-$_historyKeySalt')),
        const ShoppingListScreen(),
        const ReportsScreen(),
      ];

  Future<void> _openCapture() async {
    final invoiceId = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const CaptureScreen()),
    );
    if (invoiceId == null || !mounted) return;
    setState(() {
      _dashboardKeySalt++;
      _historyKeySalt++;
      _index = 0; // jump to Home so the freshly captured receipt is visible
    });
  }

  // The four tab destinations, in stack order. The capture FAB is spliced
  // into the middle by [WobblioNavBar] (captureIndex 2) and is not a tab.
  static const _navItems = [
    WobblioNavItem(icon: LucideIcons.layout_dashboard, label: 'Home'),
    WobblioNavItem(icon: LucideIcons.receipt, label: 'Receipts'),
    WobblioNavItem(icon: LucideIcons.shopping_cart, label: 'Shopping'),
    WobblioNavItem(icon: LucideIcons.chart_pie, label: 'Reports'),
  ];

  @override
  Widget build(BuildContext context) {
    // The floating nav overlays the content, so reserve bottom space in the
    // tabs' scroll area for the pill (70px) + its 14px inset + a little air.
    final media = MediaQuery.of(context);
    return Scaffold(
      key: const Key('app-shell'),
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: Stack(
        children: [
          MediaQuery(
            data: media.copyWith(
              padding: media.padding.copyWith(
                bottom: media.padding.bottom + 96,
              ),
            ),
            child: IndexedStack(index: _index, children: _tabs),
          ),
          Positioned(
            left: 14,
            right: 14,
            bottom: 14 + media.padding.bottom,
            child: WobblioNavBar(
              key: const Key('app-shell-nav'),
              items: _navItems,
              currentIndex: _index,
              onSelect: (tapped) => setState(() => _index = tapped),
              onCapture: _openCapture,
            ),
          ),
        ],
      ),
    );
  }
}
