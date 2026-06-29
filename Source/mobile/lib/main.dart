import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'package:wobblio/app.dart';
import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/core/config/app_config.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/auth_token_provider.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';
import 'package:wobblio/infrastructure/adapters/app_auth_cognito_authenticator.dart';
import 'package:wobblio/infrastructure/adapters/cognito_auth_token_provider.dart';
import 'package:wobblio/infrastructure/adapters/dio_api_client.dart';
import 'package:wobblio/infrastructure/adapters/flutter_secure_token_store.dart';
import 'package:wobblio/infrastructure/adapters/http_profile_repository.dart';

/// Service locator. The composition root is the ONLY place that knows about
/// both ports and their concrete adapters — keeping the hexagonal boundary
/// intact (see `.claude/rules/flutter-architecture-guard.md`).
final GetIt locator = GetIt.instance;

/// Wires adapters -> ports. Call once at startup. Tests that need the locator
/// should `locator.reset()` first, since re-registering throws.
void configureDependencies() {
  locator
    ..registerLazySingleton<ISecureTokenStore>(FlutterSecureTokenStore.new)
    ..registerLazySingleton<ICognitoAuthenticator>(
      AppAuthCognitoAuthenticator.new,
    )
    // One instance, exposed both as the IAuthTokenProvider the API client uses
    // and as the concrete type whose onSessionExpired stream the AuthBloc reads.
    ..registerLazySingleton<CognitoAuthTokenProvider>(
      () => CognitoAuthTokenProvider(
        tokenStore: locator<ISecureTokenStore>(),
        authenticator: locator<ICognitoAuthenticator>(),
      ),
    )
    ..registerLazySingleton<IAuthTokenProvider>(
      () => locator<CognitoAuthTokenProvider>(),
    )
    ..registerLazySingleton<IApiClient>(
      () => DioApiClient(
        baseUrl: AppConfig.apiBaseUrl,
        tokenProvider: locator<IAuthTokenProvider>(),
      ),
    )
    ..registerLazySingleton<IProfileRepository>(
      () => HttpProfileRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<AuthBloc>(
      () => AuthBloc(
        authenticator: locator<ICognitoAuthenticator>(),
        tokenStore: locator<ISecureTokenStore>(),
        profileRepository: locator<IProfileRepository>(),
        onSessionExpired: locator<CognitoAuthTokenProvider>().onSessionExpired,
      ),
    );
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  configureDependencies();
  final authBloc = locator<AuthBloc>()..add(const AuthBootstrapRequested());
  runApp(WobblioApp(authBloc: authBloc));
}
