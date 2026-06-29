import 'package:equatable/equatable.dart';

/// The DB-canonical user profile read from `GET /me/profile`.
///
/// [onboarded] is the single source of truth for the onboarding gate — never
/// read from Cognito attributes (memories `onboarding-source-of-truth`,
/// `no-cognito-profile-attrs`). Only the fields the auth gate needs are modelled
/// here; the backend returns more (country, currency, …) for later slices.
class UserProfile extends Equatable {
  const UserProfile({
    required this.onboarded,
    required this.fullName,
    required this.role,
    required this.status,
  });

  final bool onboarded;
  final String fullName;
  final String role;
  final String status;

  @override
  List<Object?> get props => [onboarded, fullName, role, status];
}
