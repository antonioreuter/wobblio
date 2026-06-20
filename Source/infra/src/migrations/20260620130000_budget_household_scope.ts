import type { MigrationBuilder } from 'node-pg-migrate';

// HOUSEHOLD budget scope: a budget that sums every member's household-space
// invoices (optional category filter). A new enum value cannot be used in the
// same transaction it is added in, so this migration only adds the value and
// runs outside a transaction; the spend function that uses it lands next.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(`ALTER TYPE budget_scope ADD VALUE IF NOT EXISTS 'HOUSEHOLD';`);
}

// Postgres cannot drop a single enum value without recreating the type and
// rewriting every dependent column/function. The unused value is harmless, so
// the down is a documented no-op.
export async function down(): Promise<void> {
  // intentionally empty — see note above
}
