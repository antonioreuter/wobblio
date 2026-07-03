import 'package:wobblio/core/splitting/split_assignment.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

/// Port: the six `/invoices/{id}/splits...` bill-splitting routes (18h,
/// Premium-gated — every route 403s for a non-PREMIUM/TESTER/ADMIN caller).
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

  /// `GET /invoices/{id}/splits/{splitId}` → that split's line assignments.
  /// A 404 here (unknown/stale split id) is how the bloc detects a cached id
  /// needs replacing.
  Future<List<SplitAssignment>> getSplit(String invoiceId, String splitId);

  /// `PATCH /invoices/{id}/splits/{splitId}/lines/{lineId}` — assigns (or
  /// re-assigns) a line to [participantName] at [fraction] (must be in
  /// `(0,1]`; the backend rejects `"You"` as a participant name with a 400 —
  /// it's the implicit remainder owner, never PATCH-able).
  Future<void> assignLine(
    String invoiceId,
    String splitId,
    String lineId,
    String participantName, {
    double fraction = 1,
  });

  /// `DELETE /invoices/{id}/splits/{splitId}/lines/{lineId}/assignment`.
  Future<void> unassignLine(String invoiceId, String splitId, String lineId);

  /// `GET /invoices/{id}/splits/{splitId}/summary` → the per-person total
  /// projection. The fee-pool-proportional-share math lives only on the
  /// backend — callers must refetch this after every mutation rather than
  /// recompute it.
  Future<SplitSummary> getSummary(String invoiceId, String splitId);

  /// `GET /invoices/{id}/splits/{splitId}/whatsapp` → the backend's
  /// pre-formatted export text.
  Future<String> getWhatsAppText(String invoiceId, String splitId);
}
