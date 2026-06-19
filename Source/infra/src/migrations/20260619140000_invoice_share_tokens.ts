import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- ── Public read-only invoice share links (token, encrypted at rest per §7.5 /
    -- invariant #9) ─────────────────────────────────────────────────────────────
    -- token_hash: sha256(raw token) for O(1) resolve lookup (the URL "magic id").
    -- token_enc:  KMS-envelope ciphertext of the raw token (the at-rest secret).
    -- The raw token lives only in the /r/<token> URL; the invoice id is never exposed.
    CREATE TABLE invoice_share (
      id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id         UUID        NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
      token_hash         TEXT        NOT NULL,
      token_enc          TEXT        NOT NULL,
      created_by_user_id UUID        NOT NULL REFERENCES app_user(id),
      expires_at         TIMESTAMPTZ NOT NULL,
      revoked_at         TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX invoice_share_token_hash_uidx ON invoice_share (token_hash);
    CREATE INDEX invoice_share_invoice_idx ON invoice_share (invoice_id);

    ALTER TABLE invoice_share ENABLE ROW LEVEL SECURITY;

    -- Only the creator manages their share links (USING doubles as the INSERT check).
    CREATE POLICY tenant_isolation ON invoice_share
      USING (created_by_user_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ── resolve_invoice_share: crosses RLS (the public viewer has no tenant) ─────
    -- Runs as owner (bypasses RLS) so a token holder can resolve the share without
    -- a tenant context; returns the target invoice + its owning tenant so the caller
    -- can SET LOCAL app.current_tenant_id and read the invoice through normal RLS.
    CREATE OR REPLACE FUNCTION resolve_invoice_share(p_token_hash TEXT)
    RETURNS TABLE (invoice_id UUID, tenant_id UUID)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT s.invoice_id, i.tenant_id
      FROM invoice_share s
      JOIN invoice i ON i.id = s.invoice_id
      WHERE s.token_hash = p_token_hash
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1;
    $$;
    REVOKE ALL ON FUNCTION resolve_invoice_share(TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS resolve_invoice_share(TEXT);
    DROP TABLE IF EXISTS invoice_share CASCADE;
  `);
}
