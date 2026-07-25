import type { InvoiceStatus } from './ingestion';

// Charge-by-timing gate (Non-Functional 02 §6 / §03.1). A run is charged exactly when a
// model actually ran: the metered token total is the ground truth for that.
//
//   - Duplicate SQS delivery → handled:false, no model ran → no charge.
//   - Parsed / needs-review / fuzzy-duplicate / `unreadable` verdict → the vision model
//     ran → charge the actual tokens.
//   - Our-stack crash (system fault) → the transaction rolls back, so this gate is never
//     reached and the rolled-back meter is discarded → no charge (quarantine).
//
// Keying on the meter rather than a status allowlist removes the FAILED_PROCESSING
// ambiguity (an `unreadable` verdict and a quarantined crash share that status but only
// the former ran a model) and self-maintains as new terminal statuses are added.
//
// The lone status carve-out (fix 11 Layer C): a RETAKE_SUGGESTED run is only free when just the
// cheap primary model ran — we own a failure our base parser couldn't handle. But a retake that
// ESCALATED already spent real Sonnet/Opus tokens, so it is charged like any other escalated run;
// otherwise a user could farm unlimited premium-model calls by re-uploading a hard receipt for
// free (fix 11 review ①). Every non-retake model-ran outcome is charged the actual tokens.
export function shouldChargeIngestion(
  handled: boolean,
  modelTokens: number,
  status?: InvoiceStatus,
  escalated = false,
): boolean {
  if (!handled || modelTokens <= 0) return false;
  if (status === 'RETAKE_SUGGESTED') return escalated;
  return true;
}
