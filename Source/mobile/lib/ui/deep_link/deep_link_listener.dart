import 'dart:async';

import 'package:flutter/material.dart';

import 'package:wobblio/core/ports/deep_link_source.dart';
import 'package:wobblio/ui/shared_split/shared_split_screen.dart';

/// Listens to [IDeepLinkSource] and, on a `/s/{token}` share link, pushes the
/// public [SharedSplitScreen] onto the root navigator — above whatever
/// [AuthGate] is showing, so it works even signed-out. Handles both the
/// cold-start link ([IDeepLinkSource.initialLink]) and warm deliveries
/// ([IDeepLinkSource.links]); de-dupes so the same token isn't double-pushed.
class DeepLinkListener extends StatefulWidget {
  const DeepLinkListener({
    super.key,
    required this.source,
    required this.navigatorKey,
    required this.child,
  });

  final IDeepLinkSource source;
  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;

  @override
  State<DeepLinkListener> createState() => _DeepLinkListenerState();
}

class _DeepLinkListenerState extends State<DeepLinkListener> {
  StreamSubscription<Uri>? _subscription;
  String? _lastHandledToken;

  @override
  void initState() {
    super.initState();
    _subscription = widget.source.links.listen(_handle);
    unawaited(widget.source.initialLink().then((uri) {
      if (uri != null) _handle(uri);
    }),);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  void _handle(Uri uri) {
    final token = _shareToken(uri);
    if (token == null || token == _lastHandledToken) return;
    _lastHandledToken = token;
    // Defer to after the current frame so the navigator is mounted (matters for
    // the cold-start link, which resolves before the first frame is drawn).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.navigatorKey.currentState?.push(
        MaterialPageRoute<void>(
          builder: (_) => SharedSplitScreen(token: token),
        ),
      );
    });
  }

  // Accepts both the universal/app link `https://wobblio.app/s/{token}`
  // (pathSegments `['s', token]`) and the custom-scheme fallback
  // `wobblio://s/{token}` (host `s`, pathSegments `[token]`).
  String? _shareToken(Uri uri) {
    final segments = uri.pathSegments;
    if (uri.host == 's' && segments.isNotEmpty) return segments.first;
    if (segments.length >= 2 && segments.first == 's') return segments[1];
    return null;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
