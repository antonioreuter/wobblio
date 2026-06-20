import type { MigrationBuilder } from 'node-pg-migrate';

// DAILY budget period. A new enum value cannot be used in the same transaction it
// is added in, so this runs outside a transaction. No SQL function compares
// budget_period literals (period math lives in TypeScript), so nothing else changes.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(`ALTER TYPE budget_period ADD VALUE IF NOT EXISTS 'DAY';`);
}

// Postgres cannot drop a single enum value without recreating the type and
// rewriting every dependent column/function. The unused value is harmless.
export async function down(): Promise<void> {
  // intentionally empty — see note above
}
