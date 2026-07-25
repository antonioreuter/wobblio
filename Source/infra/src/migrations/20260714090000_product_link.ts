import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 10 — silent product links replace comparison sets (09/04). Cross-merchant comparability
// stays a per-tenant USER assertion, but it is now recorded implicitly (suggestion-chip taps on
// the trend report) instead of through a managed set. One canonical row per unordered pair
// (product_a_id < product_b_id); links are symmetric, so dismissing A↔B suppresses the
// suggestion in both directions.
//
//   • status ACCEPTED  = plotted together / rankable subject to the comparability rule (09/05)
//   • status DISMISSED = never suggest this pair again
//   • size_equivalent  = user confirmed same size/pack — the only override to comparability
//   • source SPLIT_SEED marks pairs carried over from the legacy-split migration (09/03)
//
// RLS-enabled (invariant #1): one user's links never affect another user's comparisons or the
// global price store. The old set tables are dropped in a later migration once all readers are
// switched to product_link.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TYPE product_link_status AS ENUM ('ACCEPTED', 'DISMISSED');
    CREATE TYPE product_link_source AS ENUM ('USER_TAP', 'SPLIT_SEED', 'AUTO');

    CREATE TABLE product_link (
      id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id       UUID                NOT NULL REFERENCES app_user(id),
      product_a_id    UUID                NOT NULL REFERENCES product(id),
      product_b_id    UUID                NOT NULL REFERENCES product(id),
      status          product_link_status NOT NULL,
      size_equivalent BOOL                NOT NULL DEFAULT false,
      source          product_link_source NOT NULL DEFAULT 'USER_TAP',
      created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
      CHECK (product_a_id < product_b_id),
      UNIQUE (tenant_id, product_a_id, product_b_id)
    );

    CREATE INDEX idx_product_link_tenant_a ON product_link (tenant_id, product_a_id);
    CREATE INDEX idx_product_link_tenant_b ON product_link (tenant_id, product_b_id);

    ALTER TABLE product_link ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON product_link
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- Backfill: expand each comparison set into pairwise links. All members of a set were
    -- asserted interchangeable, so every pair inside a set becomes an ACCEPTED link. A pair is
    -- size-equivalent only when both members were confirmed; it is SPLIT_SEED only when both
    -- members came from the legacy split. Runs as object owner, so RLS does not filter rows.
    INSERT INTO product_link (tenant_id, product_a_id, product_b_id, status, size_equivalent, source)
    SELECT DISTINCT ma.tenant_id,
           LEAST(ma.product_id, mb.product_id),
           GREATEST(ma.product_id, mb.product_id),
           'ACCEPTED'::product_link_status,
           ma.size_equivalent AND mb.size_equivalent,
           CASE WHEN ma.source = 'SPLIT_SEED' AND mb.source = 'SPLIT_SEED'
                THEN 'SPLIT_SEED'::product_link_source
                ELSE 'USER_TAP'::product_link_source END
    FROM product_comparison_set_member ma
    JOIN product_comparison_set_member mb
      ON mb.set_id = ma.set_id AND ma.product_id < mb.product_id
    ON CONFLICT (tenant_id, product_a_id, product_b_id) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS product_link;
    DROP TYPE IF EXISTS product_link_status;
    DROP TYPE IF EXISTS product_link_source;
  `);
}
