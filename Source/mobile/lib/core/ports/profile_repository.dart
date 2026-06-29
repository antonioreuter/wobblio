import 'package:wobblio/core/auth/user_profile.dart';

/// Port: reads the DB-canonical user profile (`GET /me/profile`). The adapter
/// goes through [IApiClient]; deserialization stays in infrastructure.
abstract class IProfileRepository {
  Future<UserProfile> fetchProfile();
}
