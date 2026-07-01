import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- ── Category lock (§10b) ─────────────────────────────────────────────────────
    -- Added nullable first so existing rows don't break, backfilled to Groceries
    -- (the safest default), then tightened. Only the two category macros a
    -- shopping list may ever use.
    ALTER TABLE shopping_list ADD COLUMN category_id TEXT NULL REFERENCES product_category(id);
    UPDATE shopping_list SET category_id = 'cat-groceries' WHERE category_id IS NULL;
    ALTER TABLE shopping_list ALTER COLUMN category_id SET NOT NULL;
    ALTER TABLE shopping_list ADD CONSTRAINT shopping_list_category_chk
      CHECK (category_id IN ('cat-groceries', 'cat-personal-care'));

    -- ── Premium per-list region override (§10b/§10c) ────────────────────────────
    -- NULL on both = inherit the shopper's own profile region/country.
    ALTER TABLE shopping_list ADD COLUMN region_code TEXT NULL;
    ALTER TABLE shopping_list ADD COLUMN country_code TEXT NULL;

    -- ── Per-item quantity (§10b) ─────────────────────────────────────────────────
    ALTER TABLE shopping_list_item ADD COLUMN quantity SMALLINT NOT NULL DEFAULT 1;
    ALTER TABLE shopping_list_item ADD CONSTRAINT shopping_list_item_quantity_chk CHECK (quantity > 0);

    -- ── Public read-only + checkbox-only shopping-list share links (token,
    -- encrypted at rest per §7.5 / invariant #9) — modeled directly on
    -- invoice_share / resolve_invoice_share (20260619140000_invoice_share_tokens).
    -- token_hash: sha256(raw token) for O(1) resolve lookup (the URL "magic id").
    -- token_enc:  KMS-envelope ciphertext of the raw token (the at-rest secret).
    -- The raw token lives only in the /shared-lists/<token> URL; the list id is
    -- never exposed.
    CREATE TABLE shopping_list_share (
      id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      list_id            UUID        NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
      token_hash         TEXT        NOT NULL,
      token_enc          TEXT        NOT NULL,
      created_by_user_id UUID        NOT NULL REFERENCES app_user(id),
      expires_at         TIMESTAMPTZ NOT NULL,
      revoked_at         TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX shopping_list_share_token_hash_uidx ON shopping_list_share (token_hash);
    CREATE INDEX shopping_list_share_list_idx ON shopping_list_share (list_id);

    ALTER TABLE shopping_list_share ENABLE ROW LEVEL SECURITY;

    -- Only the creator manages their own list's share links.
    CREATE POLICY tenant_isolation ON shopping_list_share
      USING (created_by_user_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ── resolve_shopping_list_share: crosses RLS (the public viewer has no
    -- tenant). Runs as owner (bypasses RLS) so a token holder can resolve the
    -- share without a tenant context; returns the target list + its owning
    -- tenant so the caller can SET LOCAL app.current_tenant_id and read/write
    -- the list through normal RLS from that point on.
    CREATE OR REPLACE FUNCTION resolve_shopping_list_share(p_token_hash TEXT)
    RETURNS TABLE (list_id UUID, tenant_id UUID)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT s.list_id, l.tenant_id
      FROM shopping_list_share s
      JOIN shopping_list l ON l.id = s.list_id
      WHERE s.token_hash = p_token_hash
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1;
    $$;
    REVOKE ALL ON FUNCTION resolve_shopping_list_share(TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS resolve_shopping_list_share(TEXT);
    DROP TABLE IF EXISTS shopping_list_share CASCADE;
    ALTER TABLE shopping_list_item DROP CONSTRAINT IF EXISTS shopping_list_item_quantity_chk;
    ALTER TABLE shopping_list_item DROP COLUMN IF EXISTS quantity;
    ALTER TABLE shopping_list DROP CONSTRAINT IF EXISTS shopping_list_category_chk;
    ALTER TABLE shopping_list DROP COLUMN IF EXISTS category_id;
    ALTER TABLE shopping_list DROP COLUMN IF EXISTS region_code;
    ALTER TABLE shopping_list DROP COLUMN IF EXISTS country_code;
  `);
}
