import type { MigrationBuilder } from 'node-pg-migrate';

// Remove the merchant_branch subsystem (amendment 2026-06-21). The branch level of the
// §6.2 two-level identity is consumed by nothing: price_observation is keyed
// product × merchant × region (no branch_id), the §6.5.3 split-route optimizer is
// merchant+region granular, the resolver always returned branchId=null and no code ever
// inserted a branch row. invoice.branch_id and merchant_alias.branch_id were always null.
//
// Must run after 20260621140000_merge_duplicate_seed_merchants (which reassigned
// merchant_branch FKs during its run) — the timestamp ordering guarantees that.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice        DROP COLUMN branch_id;
    ALTER TABLE merchant_alias DROP COLUMN branch_id;
    DROP TABLE merchant_branch;
  `);
}

// Best-effort recreation of the structure; branch data itself is not restorable.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE merchant_branch (
      id                   UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
      merchant_id          UUID  NOT NULL REFERENCES merchant(id),
      branch_label         TEXT  NULL,
      address              TEXT  NULL,
      city                 TEXT  NULL,
      postal_code          TEXT  NULL,
      geo_point            POINT NULL,
      external_store_number TEXT NULL
    );
    ALTER TABLE merchant_alias ADD COLUMN branch_id UUID NULL REFERENCES merchant_branch(id);
    ALTER TABLE invoice        ADD COLUMN branch_id UUID NULL REFERENCES merchant_branch(id);
  `);
}
