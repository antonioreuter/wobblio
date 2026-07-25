import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 07/01 — coarse "which stage is this invoice in" progress, so a PROCESSING row can render
// an honest stage label instead of a generic spinner for the ~18s the pipeline takes.
//
// A separate row, NOT a column on `invoice`: the worker runs its whole pipeline inside ONE
// transaction that UPDATEs the invoice row at finalize and holds that row lock until COMMIT, so
// a progress write against the same row would serialize behind it (and be invisible until the
// commit that makes it pointless). A dedicated row has zero contention with the pipeline.
//
// tenant_id is copied from the invoice (the uploader), never re-derived, so the RLS predicate
// matches `invoice`'s base tenant_isolation policy exactly. Household members reading another
// member's in-flight invoice see no progress row and fall back to RECEIVED — a cosmetic
// degradation on a best-effort telemetry surface, not a correctness gap.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE invoice_processing_progress (
      invoice_id UUID        PRIMARY KEY REFERENCES invoice(id) ON DELETE CASCADE,
      tenant_id  UUID        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      stage      TEXT        NOT NULL CHECK (stage IN ('RECEIVED', 'READING', 'MATCHING', 'FINALIZING')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX invoice_processing_progress_tenant_idx ON invoice_processing_progress (tenant_id);

    ALTER TABLE invoice_processing_progress ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON invoice_processing_progress
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS invoice_processing_progress CASCADE;`);
}
