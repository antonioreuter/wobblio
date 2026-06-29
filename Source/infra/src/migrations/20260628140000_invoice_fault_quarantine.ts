import type { MigrationBuilder } from 'node-pg-migrate';

// Non-Functional 02 · 03 — system-fault quarantine.
// failure_reason_code: any terminal failure's friendly reason code (BLURRY,
//   NOT_A_RECEIPT, UNSUPPORTED_FORMAT, TOO_LARGE, SYSTEM_FAULT). User-fault failures
//   (e.g. an unreadable photo) set only this and stay deletable.
// system_fault_reason: internal root cause, set ONLY for our-stack crashes. It is the
//   quarantine key — an invoice is quarantined iff this is NOT NULL — and gates deletion.
// blocked_at: when the quarantine was applied.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      ADD COLUMN IF NOT EXISTS failure_reason_code TEXT NULL,
      ADD COLUMN IF NOT EXISTS system_fault_reason TEXT NULL,
      ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      DROP COLUMN IF EXISTS failure_reason_code,
      DROP COLUMN IF EXISTS system_fault_reason,
      DROP COLUMN IF EXISTS blocked_at;
  `);
}
