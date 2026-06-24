import type { MigrationBuilder } from 'node-pg-migrate';

// Append-only operator audit trail for the admin console (Epic 10 / admin-console 00).
// Every admin mutation — SSM edits, model swaps, DLQ deletes/replays, curation
// decisions, waitlist releases — records one row here. Reads never audit.
//
// Globally readable (no RLS): this is an operator table with no tenant/user data
// to isolate. actor_user_id is the ADMIN who performed the action; before/after
// capture the changed value where one exists (nullable for create/delete actions).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE admin_audit_log (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      actor_user_id   UUID        NOT NULL REFERENCES app_user(id),
      actor_email     TEXT        NOT NULL,
      action          TEXT        NOT NULL,
      target          TEXT        NOT NULL,
      "before"        JSONB       NULL,
      "after"         JSONB       NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Swap-history / filtered-action views (e.g. action='model.swap') read by
    -- newest first, so index the action+time pair used by those queries.
    CREATE INDEX admin_audit_log_action_created_idx
      ON admin_audit_log (action, created_at DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS admin_audit_log CASCADE;`);
}
