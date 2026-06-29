import type { MigrationBuilder } from 'node-pg-migrate';

// Non-Functional 02 · 01/04 — persist the presign quota decision on the invoice.
// quota_pooled records whether the upload was authorized against the shared household
// pool (HOUSEHOLD_CREDITS, keyed by household_id) or the uploader's personal counter
// (CREDITS). The worker charges THIS persisted decision rather than re-resolving live
// membership, so a join/leave in the presign→worker window can't redirect the charge to
// a different counter than the one presign checked (and than the invoice is attributed
// to). Defaults false: any invoice presigned before this migration charges personally
// (the accepted one-time cutover behaviour).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      ADD COLUMN IF NOT EXISTS quota_pooled BOOLEAN NOT NULL DEFAULT false;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      DROP COLUMN IF EXISTS quota_pooled;
  `);
}
