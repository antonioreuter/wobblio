/// Port: caches the locally-resolved split id per invoice.
///
/// `POST /invoices/{id}/splits` has no idempotency — every call mints a new
/// split row — so [SplitBillBloc] resolves and caches the id it last used per
/// invoice, mirroring the webapp's `use-bill-split.ts` `localStorage`
/// workaround (`STORAGE_PREFIX = 'wobblio:split:'`). Concrete adapter (over
/// `shared_preferences`) lives in `infrastructure/adapters/`.
abstract class ISplitIdCache {
  Future<String?> read(String invoiceId);

  Future<void> write(String invoiceId, String splitId);
}
