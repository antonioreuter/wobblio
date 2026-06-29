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
export function shouldChargeIngestion(handled: boolean, modelTokens: number): boolean {
  return handled && modelTokens > 0;
}
