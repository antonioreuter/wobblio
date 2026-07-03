import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/ui/auth/auth_gate.dart';
import 'package:wobblio/ui/design_system/aurora_background.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Root widget: applies the Obsidian-Aurora dark theme and hosts the [AuthBloc]
/// that drives the [AuthGate] router. The bloc is created and bootstrapped at
/// the composition root (`main.dart`) and provided here for the widget tree.
/// [AuroraBackground] mounts once here (behind every pre-auth and
/// authenticated screen) rather than per-screen.
class WobblioApp extends StatelessWidget {
  const WobblioApp({super.key, required this.authBloc});

  final AuthBloc authBloc;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>.value(
      value: authBloc,
      child: MaterialApp(
        title: 'Wobblio',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        // Mount the aurora behind the Navigator (not just the first route) so it
        // shows through on EVERY screen — pushed routes like Invoice Detail and
        // Account included. As `home` it sat below pushed routes, which paint
        // flat black over it; via `builder` it's behind the whole route stack.
        builder: (context, child) => ColoredBox(
          color: AppColors.background,
          child: Stack(
            children: [
              const Positioned.fill(child: AuroraBackground()),
              if (child != null) Positioned.fill(child: child),
            ],
          ),
        ),
        home: const AuthGate(),
      ),
    );
  }
}
