import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/profile_repository.dart';

/// [IProfileRepository] over the backend `GET /me/profile`. Maps the JSON body
/// to [UserProfile]; only the fields the auth gate needs are read (the backend
/// also returns country/currency/… for later slices). `onboarded` is taken
/// strictly — anything but `true` keeps the user in onboarding.
class HttpProfileRepository implements IProfileRepository {
  HttpProfileRepository(this._api);

  final IApiClient _api;

  @override
  Future<UserProfile> fetchProfile() async {
    final response = await _api.get('/me/profile');
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Malformed /me/profile response', statusCode: 502);
    }
    return UserProfile(
      onboarded: data['onboarded'] == true,
      fullName: (data['fullName'] as String?) ?? '',
      role: (data['role'] as String?) ?? 'STANDARD',
      status: (data['status'] as String?) ?? 'ACTIVE',
    );
  }
}
