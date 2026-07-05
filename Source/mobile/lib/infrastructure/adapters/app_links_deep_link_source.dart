import 'package:app_links/app_links.dart';

import 'package:wobblio/core/ports/deep_link_source.dart';

/// [IDeepLinkSource] over the `app_links` plugin. Wraps both the cold-start
/// link (`getInitialLink`) and the warm-delivery stream (`uriLinkStream`).
class AppLinksDeepLinkSource implements IDeepLinkSource {
  AppLinksDeepLinkSource([AppLinks? appLinks])
      : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;

  @override
  Future<Uri?> initialLink() => _appLinks.getInitialLink();

  @override
  Stream<Uri> get links => _appLinks.uriLinkStream;
}
