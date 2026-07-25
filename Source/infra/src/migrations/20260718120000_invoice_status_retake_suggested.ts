import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 11 Layer C — a photo receipt whose parse is still objectively broken (reconciliation /
// coverage) after the escalation ladder gets a distinct RETAKE_SUGGESTED terminal status:
// the user is asked to retake (flat / in sections) and the run is NOT charged, instead of
// silently landing in NEEDS_REVIEW with fabricated line data. Adds the enum label the worker
// (ExtractionPreparer Layer C) and API (getDetail failure_reason_code) write.
//
// ALTER TYPE ... ADD VALUE cannot run inside a transaction, so this migration opts out. The
// label is additive and idempotent; PostgreSQL cannot drop an enum value, so down is a no-op.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(`ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'RETAKE_SUGGESTED'`);
}

export async function down(): Promise<void> {
  // PostgreSQL does not support removing a value from an enum type — the label is left in place.
}
