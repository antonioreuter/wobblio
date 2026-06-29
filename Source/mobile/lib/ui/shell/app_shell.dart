import 'package:flutter/material.dart';

import 'package:wobblio/ui/theme/app_theme.dart';

/// Placeholder application shell. Later slices replace the body with the
/// capture-first home (16c) and dashboard (16d); for 16a it simply proves the
/// app boots and the Obsidian-Aurora theme is applied.
class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      key: const Key('app-shell'),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.receipt_long,
              size: 48,
              color: AppColors.brand,
            ),
            const SizedBox(height: 16),
            Text('Wobblio', style: textTheme.bodyLarge),
            const SizedBox(height: 4),
            Text('Capture-first receipts', style: textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
