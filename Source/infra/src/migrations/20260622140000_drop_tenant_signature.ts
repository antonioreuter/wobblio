import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS tenant_signature CASCADE;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE tenant_signature (
      tenant_id      UUID        NOT NULL,
      device_hash    TEXT        NOT NULL,
      ip_prefix_hash TEXT        NOT NULL,
      first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, device_hash)
    );
  `);
}
