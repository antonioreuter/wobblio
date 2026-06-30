import type { MigrationBuilder } from 'node-pg-migrate';

// Mobile 16f — device push registration. One row per (tenant, platform, token): the
// device tokens a tenant's installs registered for FCM/APNs push. The ingestion worker
// reads them post-COMMIT to deliver best-effort terminal-status pushes (PARSED /
// NEEDS_REVIEW / FAILED_PROCESSING) via SNS; the in-app notification store stays the
// source of truth, so a push (or this whole table being empty) never blocks ingestion.
//
// Tenant-scoped (holds tenant_id) → RLS, same as every other personal-data table; no
// FORCE RLS (memory rls-app-role). ON DELETE CASCADE satisfies the GDPR hard-purge.
// last_error_at flags a soft delivery error; it is cleared when the same device
// re-registers. A hard SNS rejection (EndpointDisabled/InvalidParameter) deletes the row.
//
// Table grants to the runtime role are reconciled by deploy (GRANT ON ALL TABLES),
// mirroring the other migrations — no explicit GRANT here.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE device_token (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      platform      TEXT        NOT NULL CHECK (platform IN ('FCM', 'APNS')),
      token         TEXT        NOT NULL,
      last_error_at TIMESTAMPTZ NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX device_token_tenant_platform_token_uidx
      ON device_token (tenant_id, platform, token);
    CREATE INDEX device_token_tenant_idx ON device_token (tenant_id);

    ALTER TABLE device_token ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON device_token
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS device_token CASCADE;
  `);
}
