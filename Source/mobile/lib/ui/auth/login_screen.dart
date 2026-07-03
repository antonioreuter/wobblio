import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Sign-in screen. A single CTA launches the Cognito Hosted-UI flow; [isBusy]
/// swaps it for a spinner while authentication is in flight, and [error]
/// surfaces a failed attempt.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key, this.isBusy = false, this.error});

  final bool isBusy;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      key: const Key('login-screen'),
      backgroundColor: Colors.transparent,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.receipt_long, size: 56, color: AppColors.brand),
              const SizedBox(height: 24),
              Text('Wobblio', style: textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                'Sign in to capture and track your receipts.',
                style: textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              if (isBusy)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: CircularProgressIndicator(),
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const Key('login-button'),
                    onPressed: () => context
                        .read<AuthBloc>()
                        .add(const AuthLoginRequested()),
                    child: const Text('Sign in'),
                  ),
                ),
              if (error != null) ...[
                const SizedBox(height: 16),
                Text(
                  error!,
                  key: const Key('login-error'),
                  style: textTheme.bodySmall?.copyWith(color: AppColors.danger),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
