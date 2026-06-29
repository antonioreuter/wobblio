import type { MigrationBuilder } from 'node-pg-migrate';

// Credit-based quota (Non-Functional 02 §4): the weekly counter moves from invoice
// counts (UPLOADS/HOUSEHOLD_UPLOADS) to credits (1 credit = 1 LLM token). These two
// values back the personal and pooled credit counters.
//
// MUST be a standalone, NON-transactional migration. PostgreSQL forbids USING a new enum
// value in the same transaction that ADDed it, and node-pg-migrate runs the whole pending
// batch in ONE transaction by default — so a behind environment applying this together with
// the 'CREDITS'-using migration (120100) fails with 55P04. `noTransaction()` runs this one
// outside the batch tx, committing the new enum values before any later migration uses them.
// (It worked locally only because the two were applied in separate incremental runs.)
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(`ALTER TYPE quota_counter_type ADD VALUE IF NOT EXISTS 'CREDITS';`);
  pgm.sql(`ALTER TYPE quota_counter_type ADD VALUE IF NOT EXISTS 'HOUSEHOLD_CREDITS';`);
}

// Enum values cannot be removed in PostgreSQL; the legacy UPLOADS/HOUSEHOLD_UPLOADS/
// UPLOAD_FAILURE_REFUNDS values remain and are harmless.
export async function down(): Promise<void> {
  // intentionally empty
}
