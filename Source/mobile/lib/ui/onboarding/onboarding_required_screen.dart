import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Placeholder onboarding gate: a signed-in user whose `onboarded` flag is false
/// lands here. The full mobile onboarding flow is a later slice — for now we
/// point them to the web to finish setup and offer a sign-out.
class OnboardingRequiredScreen extends StatelessWidget {
  const OnboardingRequiredScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      key: const Key('onboarding-required-screen'),
      backgroundColor: Colors.transparent,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.flag_outlined, size: 56, color: AppColors.brand),
              const SizedBox(height: 24),
              Text('Finish setting up', style: textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                'Complete your account setup on the Wobblio web app, then return '
                'here to start capturing receipts.',
                style: textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              TextButton(
                key: const Key('onboarding-signout-button'),
                onPressed: () =>
                    context.read<AuthBloc>().add(const AuthLogoutRequested()),
                child: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
