import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'package:wobblio/app.dart';
import 'package:wobblio/core/bloc/account/account_bloc.dart';
import 'package:wobblio/core/bloc/auth/auth_bloc.dart';
import 'package:wobblio/core/bloc/budgets/budget_bloc.dart';
import 'package:wobblio/core/bloc/capture/capture_bloc.dart';
import 'package:wobblio/core/bloc/dashboard/dashboard_bloc.dart';
import 'package:wobblio/core/bloc/history/history_bloc.dart';
import 'package:wobblio/core/bloc/invoice_detail/invoice_detail_bloc.dart';
import 'package:wobblio/core/bloc/notifications/notification_bloc.dart';
import 'package:wobblio/core/bloc/reports/price_report_bloc.dart';
import 'package:wobblio/core/bloc/review/review_bloc.dart';
import 'package:wobblio/core/bloc/shared_split/shared_split_bloc.dart';
import 'package:wobblio/core/bloc/shopping_list/shopping_list_bloc.dart';
import 'package:wobblio/core/bloc/spend_breakdown/spend_breakdown_bloc.dart';
import 'package:wobblio/core/bloc/split_bill/split_bill_bloc.dart';
import 'package:wobblio/core/config/app_config.dart';
import 'package:wobblio/core/ports/api_client.dart';
import 'package:wobblio/core/ports/auth_token_provider.dart';
import 'package:wobblio/core/ports/budget_repository.dart';
import 'package:wobblio/core/ports/camera_capture.dart';
import 'package:wobblio/core/ports/cognito_authenticator.dart';
import 'package:wobblio/core/ports/deep_link_source.dart';
import 'package:wobblio/core/ports/document_picker.dart';
import 'package:wobblio/core/ports/gallery_picker.dart';
import 'package:wobblio/core/ports/ingestion_repository.dart';
import 'package:wobblio/core/ports/invoice_repository.dart';
import 'package:wobblio/core/ports/notification_repository.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/reference_repository.dart';
import 'package:wobblio/core/ports/review_repository.dart';
import 'package:wobblio/core/ports/s3_uploader.dart';
import 'package:wobblio/core/ports/secure_token_store.dart';
import 'package:wobblio/core/ports/share_presenter.dart';
import 'package:wobblio/core/ports/shopping_list_repository.dart';
import 'package:wobblio/core/ports/split_id_cache.dart';
import 'package:wobblio/core/ports/spend_report_repository.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/ports/upload_preparer.dart';
import 'package:wobblio/core/ports/insights_repository.dart';
import 'package:wobblio/core/ports/usage_repository.dart';
import 'package:wobblio/infrastructure/adapters/app_auth_cognito_authenticator.dart';
import 'package:wobblio/infrastructure/adapters/app_links_deep_link_source.dart';
import 'package:wobblio/infrastructure/adapters/cognito_auth_token_provider.dart';
import 'package:wobblio/infrastructure/adapters/dio_api_client.dart';
import 'package:wobblio/infrastructure/adapters/dio_s3_uploader.dart';
import 'package:wobblio/infrastructure/adapters/file_picker_document_adapter.dart';
import 'package:wobblio/infrastructure/adapters/flutter_secure_token_store.dart';
import 'package:wobblio/infrastructure/adapters/http_budget_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_ingestion_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_invoice_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_notification_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_product_search_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_profile_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_reference_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_review_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_shopping_list_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_spend_report_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_split_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_insights_repository.dart';
import 'package:wobblio/infrastructure/adapters/http_usage_repository.dart';
import 'package:wobblio/infrastructure/adapters/image_compress_upload_preparer.dart';
import 'package:wobblio/infrastructure/adapters/image_picker_camera_adapter.dart';
import 'package:wobblio/infrastructure/adapters/image_picker_gallery_adapter.dart';
import 'package:wobblio/infrastructure/adapters/share_plus_presenter.dart';
import 'package:wobblio/infrastructure/adapters/shared_prefs_split_id_cache.dart';

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
    ..registerLazySingleton<IInsightsRepository>(
      () => HttpInsightsRepository(locator<IApiClient>()),
    )
    // Spend Breakdown report: hierarchical category → merchant → item drill-down.
    ..registerLazySingleton<ISpendReportRepository>(
      () => HttpSpendReportRepository(locator<IApiClient>()),
    )
    // Review & correction (16e): invoice detail/correct/discard + product search.
    ..registerLazySingleton<IReviewRepository>(
      () => HttpReviewRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<IProductSearchRepository>(
      () => HttpProductSearchRepository(locator<IApiClient>()),
    )
    // Shopping List (18c): per-user lists + split-route optimizer.
    ..registerLazySingleton<IShoppingListRepository>(
      () => HttpShoppingListRepository(locator<IApiClient>()),
    )
    // Invoice Detail (18b): native OS share sheet, behind a Port.
    ..registerLazySingleton<ISharePresenter>(SharePlusPresenter.new)
    // Budgets (18d): caller's budgets + the category taxonomy reference data.
    ..registerLazySingleton<IBudgetRepository>(
      () => HttpBudgetRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<IReferenceRepository>(
      () => HttpReferenceRepository(locator<IApiClient>()),
    )
    // Notifications (18g): caller's budget-alert notifications.
    ..registerLazySingleton<INotificationRepository>(
      () => HttpNotificationRepository(locator<IApiClient>()),
    )
    // Split Bill (18h): the 6 /invoices/{id}/splits... routes, plus the
    // locally-cached split id that works around POST's lack of idempotency.
    ..registerLazySingleton<ISplitRepository>(
      () => HttpSplitRepository(locator<IApiClient>()),
    )
    ..registerLazySingleton<ISplitIdCache>(
      () => const SharedPrefsSplitIdCache(),
    )
    // Deep links (18h): inbound /s/{token} share links → the public read-only
    // shared-split page, routed above AuthGate (works signed-out).
    ..registerLazySingleton<IDeepLinkSource>(AppLinksDeepLinkSource.new)
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
        insights: locator<IInsightsRepository>(),
      ),
    )
    // Screen-scoped: a fresh review bloc per review screen.
    ..registerFactory<ReviewBloc>(
      () => ReviewBloc(
        review: locator<IReviewRepository>(),
        products: locator<IProductSearchRepository>(),
      ),
    )
    // History (18b): a fresh bloc per History tab mount.
    ..registerFactory<HistoryBloc>(
      () => HistoryBloc(invoices: locator<IInvoiceRepository>()),
    )
    // Invoice Detail (18b): parameterized by invoiceId, a fresh bloc per screen push.
    ..registerFactoryParam<InvoiceDetailBloc, String, void>(
      (invoiceId, _) => InvoiceDetailBloc(
        invoices: locator<IInvoiceRepository>(),
        share: locator<ISharePresenter>(),
        invoiceId: invoiceId,
      ),
    )
    // Shopping List (18c): a fresh bloc per Shopping tab mount.
    ..registerFactory<ShoppingListBloc>(
      () => ShoppingListBloc(
        lists: locator<IShoppingListRepository>(),
        profile: locator<IProfileRepository>(),
      ),
    )
    // Budgets (18d): a fresh bloc per Budgets screen push.
    ..registerFactory<BudgetBloc>(
      () => BudgetBloc(
        budgets: locator<IBudgetRepository>(),
        reference: locator<IReferenceRepository>(),
        profile: locator<IProfileRepository>(),
      ),
    )
    // Account (18f): a fresh bloc per Account screen push.
    ..registerFactory<AccountBloc>(
      () => AccountBloc(
        profile: locator<IProfileRepository>(),
        tokenStore: locator<ISecureTokenStore>(),
      ),
    )
    // Notifications (18g): a fresh bloc per Notifications screen push.
    ..registerFactory<NotificationBloc>(
      () => NotificationBloc(notifications: locator<INotificationRepository>()),
    )
    // Reports (19f): a fresh "Price report" bloc per Reports tab mount.
    ..registerFactory<PriceReportBloc>(
      () => PriceReportBloc(
        insights: locator<IInsightsRepository>(),
        profile: locator<IProfileRepository>(),
      ),
    )
    ..registerFactory<SpendBreakdownBloc>(
      () => SpendBreakdownBloc(
        reports: locator<ISpendReportRepository>(),
        profile: locator<IProfileRepository>(),
      ),
    )
    // Split Bill (18h): parameterized by invoiceId, a fresh bloc per screen push.
    ..registerFactoryParam<SplitBillBloc, String, void>(
      (invoiceId, _) => SplitBillBloc(
        splits: locator<ISplitRepository>(),
        invoices: locator<IInvoiceRepository>(),
        splitIdCache: locator<ISplitIdCache>(),
        profile: locator<IProfileRepository>(),
        share: locator<ISharePresenter>(),
        invoiceId: invoiceId,
      ),
    )
    // Shared Split (18h): public read-only page, parameterized by share token.
    ..registerFactoryParam<SharedSplitBloc, String, void>(
      (token, _) => SharedSplitBloc(
        splits: locator<ISplitRepository>(),
        token: token,
      ),
    );
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  configureDependencies();
  final authBloc = locator<AuthBloc>()..add(const AuthBootstrapRequested());
  runApp(
    WobblioApp(
      authBloc: authBloc,
      deepLinks: locator<IDeepLinkSource>(),
    ),
  );
}
