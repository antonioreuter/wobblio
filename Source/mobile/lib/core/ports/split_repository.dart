import 'package:wobblio/core/splitting/shared_split.dart';
import 'package:wobblio/core/splitting/split_allocation.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

/// Port: the `/invoices/{id}/splits...` bill-splitting routes plus the public
/// `/shared-splits/{token}` resolver (all split routes Premium-gated — every
/// one 403s for a non-PREMIUM/TESTER/ADMIN caller; the shared resolver is
/// public/unauthenticated).
///
/// Deliberately a thin 1:1 wire mapping — split-id resolution/caching (the
/// non-idempotent `POST` workaround) lives on [SplitBillBloc], not here; see
/// `lib/core/ports/split_id_cache.dart`. Concrete adapter (over
/// [IApiClient]) lives in `infrastructure/adapters/`; transport/4xx failures
/// surface as [ApiException].
abstract class ISplitRepository {
  /// `POST /invoices/{id}/splits` → the new split's id. Mints a fresh row on
  /// every call — never idempotent.
  Future<String> createSplit(String invoiceId);

  /// `GET /invoices/{id}/splits/{splitId}` → that split's line allocations
  /// (several may share a `lineId`). A 404 here (unknown/stale split id) is how
  /// the bloc detects a cached id needs replacing.
  Future<List<SplitAllocation>> getSplit(String invoiceId, String splitId);

  /// `PUT /invoices/{id}/splits/{splitId}/lines/{lineId}/allocations` —
  /// atomically replaces the whole allocation set for one line. Passing an
  /// empty list clears the line (remainder falls back to the implicit "You").
  /// The backend rejects `"You"` as a participant name and any total exceeding
  /// the line quantity with a 400.
  Future<void> setLineAllocations(
    String invoiceId,
    String splitId,
    String lineId,
    List<LineAllocation> allocations,
  );

  /// `GET /invoices/{id}/splits/{splitId}/summary` → the per-person total
  /// projection. The fee-pool-proportional-share math lives only on the
  /// backend — callers must refetch this after every mutation rather than
  /// recompute it.
  Future<SplitSummary> getSummary(String invoiceId, String splitId);

  /// `POST /invoices/{id}/splits/{splitId}/share` → a public read-only
  /// `/s/{token}` share URL (7-day expiry). The split id is never exposed; the
  /// unguessable token in the URL is the only credential.
  Future<String> createShareLink(String invoiceId, String splitId);

  /// `GET /shared-splits/{token}` → the public read-only breakdown behind a
  /// share link. Unauthenticated; a 404 means the link is invalid or expired.
  Future<SharedSplit> getSharedSplit(String token);
}
