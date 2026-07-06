import 'package:share_plus/share_plus.dart';

import 'package:wobblio/core/ports/share_presenter.dart';

/// [ISharePresenter] over `share_plus`'s native OS share sheet.
class SharePlusPresenter implements ISharePresenter {
  @override
  Future<void> share(String text) => Share.share(text);
}
