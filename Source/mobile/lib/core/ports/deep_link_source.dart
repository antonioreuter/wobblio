/// Port: the stream of inbound deep links the OS hands the app — a universal/
/// app link (`https://wobblio.app/s/{token}`) or the custom-scheme fallback
/// (`wobblio://s/{token}`).
///
/// Device/OS capability, so it sits behind a port with a concrete adapter (over
/// `app_links`) in `infrastructure/adapters/`, per
/// `.claude/rules/flutter-architecture-guard.md` — the router listens to this,
/// never to the plugin directly.
abstract class IDeepLinkSource {
  /// The link that cold-started the app, if any (null when launched normally).
  Future<Uri?> initialLink();

  /// Links delivered while the app is already running (warm).
  Stream<Uri> get links;
}
