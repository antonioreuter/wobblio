import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/ui/auth/login_screen.dart';
import 'package:wobblio/ui/onboarding/onboarding_required_screen.dart';
import 'package:wobblio/ui/shell/app_shell.dart';

/// Routes the app from [AuthBloc] state. A lightweight `BlocBuilder` switch is
/// enough for the four session states; deeper navigation lands in 16c/16d, so
/// no router dependency is pulled in yet.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) => switch (state) {
        AuthInitial() => const _SessionSplash(),
        AuthAuthenticating() => const LoginScreen(isBusy: true),
        AuthSignedOut(:final error) => LoginScreen(error: error),
        AuthAuthed() => const AppShell(),
        AuthOnboardingRequired() => const OnboardingRequiredScreen(),
      },
    );
  }
}

/// Shown while a persisted session is being restored at startup.
class _SessionSplash extends StatelessWidget {
  const _SessionSplash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: Key('session-splash'),
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
