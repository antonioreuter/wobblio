import type { MigrationBuilder } from 'node-pg-migrate';

// Remove ai_spend_ledger (amendment 2026-06-22). The per-tenant daily AI-spend cap it backed
// is removed — the weekly invoice quota (§2.4) is the sole upload/cost control. The table
// only ever served today's running total for the cap check; all history was dead weight.
// Per-call token telemetry continues via the bedrock_usage structured log (BedrockConverseAdapter)
// and kpi_daily, so nothing is lost. ai_spend_ledger is a global (no-RLS) table — no policy to drop.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE ai_spend_ledger;`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE ai_spend_ledger (
      id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id    UUID        NOT NULL,
      date         DATE        NOT NULL,
      model_role   TEXT        NOT NULL,
      input_tokens INT         NOT NULL,
      output_tokens INT        NOT NULL,
      est_cost     NUMERIC(10,6) NOT NULL
    );
  `);
}
