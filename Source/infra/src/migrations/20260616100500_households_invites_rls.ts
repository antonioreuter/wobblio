import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- ── Household invite tokens (encrypted at rest per §7.5 / invariant #9) ──────
    -- token_hash: sha256(raw token) for O(1) accept lookup.
    -- token_enc:  KMS-envelope ciphertext of the raw token (the at-rest secret).
    CREATE TABLE household_invite (
      id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      household_id       UUID        NOT NULL REFERENCES household(id) ON DELETE CASCADE,
      token_hash         TEXT        NOT NULL,
      token_enc          TEXT        NOT NULL,
      created_by_user_id UUID        NOT NULL REFERENCES app_user(id),
      expires_at         TIMESTAMPTZ NOT NULL,
      revoked_at         TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX household_invite_token_hash_uidx ON household_invite (token_hash);
    CREATE INDEX household_invite_household_idx ON household_invite (household_id);

    ALTER TABLE household_invite ENABLE ROW LEVEL SECURITY;

    -- SECURITY DEFINER helper: household ids the current tenant belongs to (member
    -- or owner). Runs as owner (bypasses RLS) so it can be referenced from RLS
    -- policies on household_member without self-referential recursion.
    CREATE OR REPLACE FUNCTION current_tenant_household_ids()
    RETURNS SETOF UUID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT household_id FROM household_member
        WHERE user_id = current_setting('app.current_tenant_id', true)::uuid
      UNION
      SELECT id FROM household
        WHERE owner_user_id = current_setting('app.current_tenant_id', true)::uuid
    $$;
    REVOKE ALL ON FUNCTION current_tenant_household_ids() FROM PUBLIC;

    -- Only the household owner manages invite tokens (USING doubles as INSERT check).
    CREATE POLICY tenant_isolation ON household_invite
      USING (
        household_id IN (
          SELECT id FROM household
          WHERE owner_user_id = current_setting('app.current_tenant_id', true)::uuid
        )
      );

    -- ── Widen household-scoped reads to every member ────────────────────────────
    -- household_member: members/owner see the full roster (base tenant_isolation
    -- only exposes a user's own membership row).
    CREATE POLICY household_member_visibility ON household_member
      FOR SELECT
      USING (household_id IN (SELECT current_tenant_household_ids()));

    -- invoice / invoice_line: members read household-space rows. Read-only — writes
    -- stay uploader-scoped via the existing tenant_isolation (FOR ALL) policy.
    CREATE POLICY household_member_read ON invoice
      FOR SELECT
      USING (
        household_id IS NOT NULL
        AND household_id IN (SELECT current_tenant_household_ids())
      );

    CREATE POLICY household_member_read ON invoice_line
      FOR SELECT
      USING (
        invoice_id IN (
          SELECT id FROM invoice
          WHERE household_id IS NOT NULL
            AND household_id IN (SELECT current_tenant_household_ids())
        )
      );

    -- ── Household upload pool keyed by household_id (Epic 09 quota mechanics) ────
    -- The 20/week pool is shared across members, so the HOUSEHOLD_UPLOADS counter
    -- is keyed by household_id (not uploader). Drop the app_user FK (tenant_id now
    -- holds a household_id for household counters) and widen RLS to members.
    ALTER TABLE quota_counter DROP CONSTRAINT IF EXISTS quota_counter_tenant_id_fkey;

    DROP POLICY IF EXISTS tenant_isolation ON quota_counter;
    CREATE POLICY tenant_isolation ON quota_counter
      USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        OR tenant_id IN (SELECT current_tenant_household_ids())
      );

    -- ── accept_household_invite: crosses RLS (accepter is not yet a member) ──────
    CREATE OR REPLACE FUNCTION accept_household_invite(
      p_token_hash TEXT,
      p_user_id    UUID
    )
    RETURNS TABLE (result_code TEXT, household_id UUID)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_household_id UUID;
      v_count        INT;
    BEGIN
      SELECT hi.household_id INTO v_household_id
      FROM household_invite hi
      WHERE hi.token_hash = p_token_hash
        AND hi.revoked_at IS NULL
        AND hi.expires_at > now()
      LIMIT 1;

      IF v_household_id IS NULL THEN
        RETURN QUERY SELECT 'INVALID'::TEXT, NULL::UUID;
        RETURN;
      END IF;

      IF EXISTS (
        SELECT 1 FROM household_member
        WHERE household_id = v_household_id AND user_id = p_user_id
      ) THEN
        RETURN QUERY SELECT 'ALREADY_MEMBER'::TEXT, v_household_id;
        RETURN;
      END IF;

      SELECT count(*) INTO v_count FROM household_member WHERE household_id = v_household_id;
      IF v_count >= 5 THEN
        RETURN QUERY SELECT 'FULL'::TEXT, v_household_id;
        RETURN;
      END IF;

      INSERT INTO household_member (household_id, user_id) VALUES (v_household_id, p_user_id);
      RETURN QUERY SELECT 'OK'::TEXT, v_household_id;
    END;
    $$;
    REVOKE ALL ON FUNCTION accept_household_invite(TEXT, UUID) FROM PUBLIC;

    -- ── remove_household_member: owner removes another member (crosses RLS) ──────
    CREATE OR REPLACE FUNCTION remove_household_member(
      p_household_id UUID,
      p_member_id    UUID,
      p_owner_id     UUID
    )
    RETURNS BOOLEAN
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_is_owner BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM household WHERE id = p_household_id AND owner_user_id = p_owner_id
      ) INTO v_is_owner;
      IF NOT v_is_owner OR p_member_id = p_owner_id THEN RETURN false; END IF;

      DELETE FROM household_member WHERE household_id = p_household_id AND user_id = p_member_id;
      RETURN true;
    END;
    $$;
    REVOKE ALL ON FUNCTION remove_household_member(UUID, UUID, UUID) FROM PUBLIC;

    -- ── disband_household: owner disbands; detach invoices, drop members+invites ─
    CREATE OR REPLACE FUNCTION disband_household(
      p_household_id UUID,
      p_owner_id     UUID
    )
    RETURNS BOOLEAN
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_is_owner BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM household WHERE id = p_household_id AND owner_user_id = p_owner_id
      ) INTO v_is_owner;
      IF NOT v_is_owner THEN RETURN false; END IF;

      -- Shared invoices revert to the uploader's personal space (tenant_id unchanged).
      UPDATE invoice SET household_id = NULL WHERE household_id = p_household_id;
      DELETE FROM household_invite WHERE household_id = p_household_id;
      DELETE FROM household_member WHERE household_id = p_household_id;
      DELETE FROM household WHERE id = p_household_id;
      RETURN true;
    END;
    $$;
    REVOKE ALL ON FUNCTION disband_household(UUID, UUID) FROM PUBLIC;

    -- ── list_household_members: roster + this-week upload count per member ───────
    -- Crosses RLS to read co-members' app_user rows; callers MUST verify the
    -- requester belongs to the household before calling.
    CREATE OR REPLACE FUNCTION list_household_members(p_household_id UUID)
    RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, is_owner BOOLEAN, uploads_this_week INT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT u.id, u.email, u.full_name,
             (u.id = h.owner_user_id) AS is_owner,
             COALESCE(c.cnt, 0)::INT AS uploads_this_week
      FROM household_member m
      JOIN household h ON h.id = m.household_id
      JOIN app_user u ON u.id = m.user_id
      LEFT JOIN LATERAL (
        SELECT count(*) AS cnt
        FROM invoice i
        WHERE i.household_id = p_household_id
          AND i.uploaded_by_user_id = u.id
          AND i.status <> 'DISCARDED'
          AND i.created_at >= date_trunc('week', now())
      ) c ON true
      WHERE m.household_id = p_household_id
      ORDER BY (u.id = h.owner_user_id) DESC, u.full_name;
    $$;
    REVOKE ALL ON FUNCTION list_household_members(UUID) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS list_household_members(UUID);
    DROP FUNCTION IF EXISTS disband_household(UUID, UUID);
    DROP FUNCTION IF EXISTS remove_household_member(UUID, UUID, UUID);
    DROP FUNCTION IF EXISTS accept_household_invite(TEXT, UUID);

    DROP POLICY IF EXISTS household_member_read ON invoice_line;
    DROP POLICY IF EXISTS household_member_read ON invoice;
    DROP POLICY IF EXISTS household_member_visibility ON household_member;

    DROP POLICY IF EXISTS tenant_isolation ON quota_counter;
    CREATE POLICY tenant_isolation ON quota_counter
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    ALTER TABLE quota_counter
      ADD CONSTRAINT quota_counter_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES app_user(id);

    DROP TABLE IF EXISTS household_invite CASCADE;

    DROP FUNCTION IF EXISTS current_tenant_household_ids();
  `);
}
