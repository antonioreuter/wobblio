import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'package:wobblio/app.dart';
import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/core/bloc/capture/capture_bloc.dart';
import 'package:wobblio/core/bloc/dashboard/dashboard_bloc.dart';
import 'package:wobblio/core/bloc/review/review_bloc.dart';
import 'package:wobblio/core/config/app_config.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/auth_token_provider.dart';
import 'package:wobblio/core/ports/camera_capture.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/document_picker.dart';
import 'package:wobblio/core/ports/gallery_picker.dart';
import 'package:wobblio/core/ports/ingestion_repository.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/review_repository.dart';
import 'package:wobblio/core/ports/s3_uploader.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';
import 'package:wobblio/core/ports/upload_preparer.dart';
import 'package:wobblio/core/ports/usage_repository.dart';
import 'package:wobblio/infrastructure/adapters/app_auth_cognito_authenticator.dart';
import 'package:wobblio/infrastructure/adapters/cognito_auth_token_provider.dart';
import 'package:wobblio/infrastructure/adapters/dio_api_client.dart';
import 'package:wobblio/infrastructure/adapters/dio_s3_uploader.dart';
import 'package:wobblio/infrastructure/adapters/file_picker_document_adapter.dart';
import 'package:wobblio/infrastructure/adapters/flutter_secure_token_store.dart';
import 'package:wobblio/infrastructure/adapters/http_ingestion_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_invoice_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_product_search_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_profile_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_review_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_usage_repository.dart';
import 'package:wobblio/infrastructure/adapters/image_compress_upload_preparer.dart';
import 'package:wobblio/infrastructure/adapters/image_picker_camera_adapter.dart';
import 'package:wobblio/infrastructure/adapters/image_picker_gallery_adapter.dart';

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
    // Capture/upload (16c). Native boundaries are ports; the S3 uploader uses its
    // own client (no bearer token to the presigned host).
    ..registerLazySingleton<ICameraCapture>(ImagePickerCameraAdapter.new)
    ..registerLazySingleton<IGalleryPicker>(ImagePickerGalleryAdapter.new)
    ..registerLazySingleton<IDocumentPicker>(FilePickerDocumentAdapter.new)
    ..registerLazySingleton<IUploadPreparer>(
      () => const ImageCompressUploadPreparer(),
    )
    ..registerLazySingleton<IS3Uploader>(DioS3Uploader.new)
    ..registerLazySingleton<IIngestionRepository>(
      () => HttpIngestionRepository(locator<IApiClient>()),
    )
    // Dashboard (16d): invoice list + feedback + usage.
    ..registerLazySingleton<IInvoiceRepository>(
      () => HttpInvoiceRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<IUsageRepository>(
      () => HttpUsageRepository(locator<IApiClient>()),
    )
    // Review & correction (16e): invoice detail/correct/discard + product search.
    ..registerLazySingleton<IReviewRepository>(
      () => HttpReviewRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<IProductSearchRepository>(
      () => HttpProductSearchRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<AuthBloc>(
      () => AuthBloc(
        authenticator: locator<ICognitoAuthenticator>(),
        tokenStore: locator<ISecureTokenStore>(),
        profileRepository: locator<IProfileRepository>(),
        onSessionExpired: locator<CognitoAuthTokenProvider>().onSessionExpired,
      ),
    )
    // Screen-scoped: a fresh bloc per capture screen (unlike the singleton AuthBloc).
    ..registerFactory<CaptureBloc>(
      () => CaptureBloc(
        camera: locator<ICameraCapture>(),
        gallery: locator<IGalleryPicker>(),
        documents: locator<IDocumentPicker>(),
        preparer: locator<IUploadPreparer>(),
        uploader: locator<IS3Uploader>(),
        ingestion: locator<IIngestionRepository>(),
      ),
    )
    // Screen-scoped: a fresh dashboard bloc per shell mount.
    ..registerFactory<DashboardBloc>(
      () => DashboardBloc(
        invoices: locator<IInvoiceRepository>(),
        usage: locator<IUsageRepository>(),
      ),
    )
    // Screen-scoped: a fresh review bloc per review screen.
    ..registerFactory<ReviewBloc>(
      () => ReviewBloc(
        review: locator<IReviewRepository>(),
        products: locator<IProductSearchRepository>(),
      ),
    );
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  configureDependencies();
  final authBloc = locator<AuthBloc>()..add(const AuthBootstrapRequested());
  runApp(WobblioApp(authBloc: authBloc));
}
