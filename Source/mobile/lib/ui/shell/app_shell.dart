import 'package:flutter/material.dart';

import 'package:wobblio/ui/capture/capture_screen.dart';
import 'package:wobblio/ui/dashboard/dashboard_screen.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/history/history_screen.dart';
import 'package:wobblio/ui/reports/reports_screen.dart';
import 'package:wobblio/ui/shopping_list/shopping_list_screen.dart';

/// Authenticated home (18a): a bottom-tab shell over Home / Receipts /
/// Shopping / Reports, plus a Capture entry that pushes [CaptureScreen]
/// directly rather than living in the [IndexedStack]. All 5 of `OPTION 2A`'s
/// bottom-nav slots are now wired — Reports (18e) was the last one, having
/// no screen to point at until this slice. Each tab keeps owning its own
/// inner `Scaffold`/`AppBar`/FAB exactly as [DashboardScreen] already does —
/// only the bottom bar chrome lives here.
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('app-shell'),
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        child: BottomNavigationBar(
          key: const Key('app-shell-nav'),
          // Nav has 5 slots (Home/Receipts/Scan/Shopping/Reports); the stack
          // only has 4 tabs (Scan isn't a stack page) — shift every stack
          // index from 2 onward up by one nav position. This formula is
          // unchanged from 18a's 3-tab version: the +1 shift only depends on
          // there being exactly one non-stack slot (Scan, fixed at nav
          // position 2), not on how many tabs follow it.
          currentIndex: _index >= 2 ? _index + 1 : _index,
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.surface,
          selectedItemColor: AppColors.brand,
          unselectedItemColor: AppColors.textMuted,
          onTap: (tapped) {
            if (tapped == 2) {
              _openCapture();
              return;
            }
            setState(() => _index = tapped > 2 ? tapped - 1 : tapped);
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long),
              label: 'Receipts',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.photo_camera_outlined),
              label: 'Scan',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.checklist_outlined),
              activeIcon: Icon(Icons.checklist),
              label: 'Shopping',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.insights_outlined),
              activeIcon: Icon(Icons.insights),
              label: 'Reports',
            ),
          ],
        ),
      ),
    );
  }
}
