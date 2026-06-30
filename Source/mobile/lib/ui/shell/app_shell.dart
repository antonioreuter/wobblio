import 'package:flutter/material.dart';

import 'package:wobblio/ui/dashboard/dashboard_screen.dart';

/// Authenticated home. As of 16d this is the dashboard (recent invoices, status
/// pills, capture FAB); the capture FAB and the return-from-capture refresh live
/// inside [DashboardScreen].
class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) => const DashboardScreen();
}
