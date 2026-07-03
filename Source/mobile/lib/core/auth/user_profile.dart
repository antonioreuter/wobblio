import 'package:equatable/equatable.dart';

/// The DB-canonical user profile read from `GET /me/profile`.
///
/// [onboarded] is the single source of truth for the onboarding gate — never
/// read from Cognito attributes (memories `onboarding-source-of-truth`,
/// `no-cognito-profile-attrs`). [country]/[regionCode] (added 18e) default the
/// Reports screen's region — backend's `OnboardingProfile` always returns
/// `country`, and `regionCode` when the caller completed onboarding with one;
/// both default to `''` here rather than being nullable, matching how
/// `fullName`/`role`/`status` already default an absent field. The backend
/// also returns currency/… for later slices, not modelled here yet.
class UserProfile extends Equatable {
  const UserProfile({
    required this.onboarded,
    required this.fullName,
    required this.role,
    required this.status,
    this.country = '',
    this.regionCode = '',
  });

  final bool onboarded;
  final String fullName;
  final String role;
  final String status;
  final String country;
  final String regionCode;

  @override
  List<Object?> get props =>
      [onboarded, fullName, role, status, country, regionCode];
}
