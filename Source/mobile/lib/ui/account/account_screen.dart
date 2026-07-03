import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/account/account_bloc.dart';
import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/budgets/budgets_screen.dart';
import 'package:wobblio/ui/design_system/avatar.dart';
import 'package:wobblio/ui/design_system/badge.dart';
import 'package:wobblio/ui/design_system/button.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/design_system/tokens.dart';

/// Account screen (18f): read-only name/email/plan/status (`GET /me/profile`
/// has no editable-settings endpoint, so this stays display-only), a
/// Budgets entry point, and sign-out. See
/// `specs/mvp/18-mobile-navigation-and-lists/18f-account.md`.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AccountBloc>(
      create: (_) => locator<AccountBloc>()..add(const AccountStarted()),
      child: const _AccountView(),
    );
  }
}

class _AccountView extends StatelessWidget {
  const _AccountView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('account-screen'),
      backgroundColor: Colors.transparent,
      appBar: WobblioHeaderBar(
        title: 'Account',
        onBack: () => Navigator.of(context).maybePop(),
      ),
      body: SafeArea(
        child: BlocBuilder<AccountBloc, AccountState>(
          builder: (context, state) {
            if (state.status == AccountStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            final profile = state.profile;
            if (state.status == AccountStatus.failure || profile == null) {
              return _RetryMessage(
                onRetry: () =>
                    context.read<AccountBloc>().add(const AccountStarted()),
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _HeaderCard(profile: profile, email: state.email),
                const SizedBox(height: 16),
                _DetailsCard(profile: profile),
                const SizedBox(height: 16),
                const _BudgetsRow(),
                const SizedBox(height: 28),
                const _SignOutButton(),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.profile, required this.email});

  final UserProfile profile;
  final String? email;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Avatar(initials: _initialsFor(profile.fullName), size: 56),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.fullName.isEmpty ? 'Wobblio user' : profile.fullName,
                  style: AppTypography.display(size: AppTypography.textXl),
                  overflow: TextOverflow.ellipsis,
                ),
                if (email != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    email!,
                    style: AppTypography.body(
                        size: AppTypography.textSm, color: AppColors.textMuted,),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _initialsFor(String fullName) {
    final words = fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) return words.first[0].toUpperCase();
    return (words.first[0] + words.last[0]).toUpperCase();
  }
}

class _DetailsCard extends StatelessWidget {
  const _DetailsCard({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      child: Column(
        children: [
          _DetailRow(
            label: 'Plan',
            trailing: WobblioBadge(
                label: profile.role, tone: _roleTone(profile.role),),
          ),
          _DetailRow(
            label: 'Status',
            trailing: Text(
              profile.status,
              style: AppTypography.body(
                  size: AppTypography.textSm,
                  weight: FontWeight.w600,
                  color: AppColors.textSecondary,),
            ),
            isLast: true,
          ),
        ],
      ),
    );
  }

  static WobblioBadgeTone _roleTone(String role) =>
      role == 'STANDARD' ? WobblioBadgeTone.primary : WobblioBadgeTone.success;
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(
      {required this.label, required this.trailing, this.isLast = false,});

  final String label;
  final Widget trailing;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: AppTypography.body(
                  size: AppTypography.textSm, color: AppColors.textMuted,),),
          trailing,
        ],
      ),
    );
  }
}

class _BudgetsRow extends StatelessWidget {
  const _BudgetsRow();

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      padding: EdgeInsets.zero,
      child: InkWell(
        key: const Key('account-budgets-row'),
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const BudgetsScreen()),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              const Icon(Icons.savings_outlined, color: AppColors.brand),
              const SizedBox(width: 12),
              Expanded(
                child: Text('Budgets',
                    style: AppTypography.body(
                        size: AppTypography.textMd, weight: FontWeight.w600,),),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignOutButton extends StatelessWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: WobblioButton(
        key: const Key('account-sign-out'),
        label: 'Sign out',
        variant: WobblioButtonVariant.text,
        foregroundColor: AppColors.danger,
        iconLeft: Icons.logout,
        onPressed: () => _confirmSignOut(context),
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context) async {
    final authBloc = context.read<AuthBloc>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You’ll need to sign in again to use Wobblio.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Sign out',
                style: TextStyle(color: AppColors.danger),),
          ),
        ],
      ),
    );
    if (confirmed == true) authBloc.add(const AuthLogoutRequested());
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
          Text('Couldn’t load your account',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
