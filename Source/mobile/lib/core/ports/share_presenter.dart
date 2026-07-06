/// Port: hands text (e.g. a share link) to the platform's native share sheet.
///
/// Concrete adapter (over `share_plus`) lives in `infrastructure/adapters/` —
/// device/OS capabilities must never be called directly from a widget or
/// bloc, per `.claude/rules/flutter-architecture-guard.md`.
abstract class ISharePresenter {
  Future<void> share(String text);
}
