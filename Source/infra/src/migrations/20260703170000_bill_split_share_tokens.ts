import type { MigrationBuilder } from 'node-pg-migrate';

// §11 — public read-only bill-split share links, mirroring invoice_share
// (20260619140000). token_hash is sha256(raw token) for O(1) resolve; token_enc is
// the KMS-envelope ciphertext at rest (invariant #9 / §7.5). The raw token lives only
// in the /s/<token> URL; the split id is never exposed.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE bill_split_share (
      id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      split_id           UUID        NOT NULL REFERENCES bill_split(id) ON DELETE CASCADE,
      token_hash         TEXT        NOT NULL,
      token_enc          TEXT        NOT NULL,
      created_by_user_id UUID        NOT NULL REFERENCES app_user(id),
      expires_at         TIMESTAMPTZ NOT NULL,
      revoked_at         TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX bill_split_share_token_hash_uidx ON bill_split_share (token_hash);
    CREATE INDEX bill_split_share_split_idx ON bill_split_share (split_id);

    ALTER TABLE bill_split_share ENABLE ROW LEVEL SECURITY;

    -- Only the creator manages their share links (USING doubles as the INSERT check).
    CREATE POLICY tenant_isolation ON bill_split_share
      USING (created_by_user_id = current_setting('app.current_tenant_id', true)::uuid);

    -- resolve_bill_split_share: crosses RLS (the public viewer has no tenant). Runs as
    -- owner so a token holder can resolve without a tenant context; returns the target
    -- split + its owning tenant so the caller can SET LOCAL app.current_tenant_id and
    -- read the split through normal RLS.
    CREATE OR REPLACE FUNCTION resolve_bill_split_share(p_token_hash TEXT)
    RETURNS TABLE (split_id UUID, tenant_id UUID)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT s.split_id, i.tenant_id
      FROM bill_split_share s
      JOIN bill_split bs ON bs.id = s.split_id
      JOIN invoice i ON i.id = bs.invoice_id
      WHERE s.token_hash = p_token_hash
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1;
    $$;
    REVOKE ALL ON FUNCTION resolve_bill_split_share(TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS resolve_bill_split_share(TEXT);
    DROP TABLE IF EXISTS bill_split_share CASCADE;
  `);
}
