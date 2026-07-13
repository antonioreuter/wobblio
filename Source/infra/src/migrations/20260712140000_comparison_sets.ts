import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 09/04 — comparison sets. Cross-merchant comparability is a USER assertion, stored per
// tenant: a set says "these products (each at its own merchant, 09/02) are interchangeable for
// me." Both tables are RLS-enabled (invariant #1), so one user's claims never affect another
// user's comparisons or the global price store — zero catalog-poisoning surface.
//
//   • size_equivalent = true means the user confirmed the members are the same size/pack; it is
//     the only override to the comparability rule (09/05).
//   • source SPLIT_SEED marks a set auto-created by the legacy-split migration (09/03), always
//     watch-only (size_equivalent = false) until the user confirms.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TYPE comparison_member_source AS ENUM ('USER', 'SPLIT_SEED');

    CREATE TABLE product_comparison_set (
      id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id  UUID        NOT NULL REFERENCES app_user(id),
      name       TEXT        NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE product_comparison_set_member (
      id              UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
      set_id          UUID                     NOT NULL REFERENCES product_comparison_set(id) ON DELETE CASCADE,
      tenant_id       UUID                     NOT NULL REFERENCES app_user(id),
      product_id      UUID                     NOT NULL REFERENCES product(id),
      source          comparison_member_source NOT NULL DEFAULT 'USER',
      size_equivalent BOOL                     NOT NULL DEFAULT false,
      added_at        TIMESTAMPTZ              NOT NULL DEFAULT now(),
      UNIQUE (set_id, product_id)
    );

    CREATE INDEX idx_comparison_set_tenant ON product_comparison_set (tenant_id);
    CREATE INDEX idx_comparison_member_set ON product_comparison_set_member (set_id);
    CREATE INDEX idx_comparison_member_tenant_product ON product_comparison_set_member (tenant_id, product_id);

    ALTER TABLE product_comparison_set        ENABLE ROW LEVEL SECURITY;
    ALTER TABLE product_comparison_set_member ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON product_comparison_set
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON product_comparison_set_member
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS product_comparison_set_member;
    DROP TABLE IF EXISTS product_comparison_set;
    DROP TYPE IF EXISTS comparison_member_source;
  `);
}
