import type { MigrationBuilder } from 'node-pg-migrate';

// Epic 09 sizing change: the household member cap drops from 5 to 3 (owner + 2),
// and the shared upload pool only activates once a household has more than one
// member. accept_household_invite now rejects the 3rd+ join, and a new
// household_member_count_for helper lets PresignService gate the pool: it returns
// the member count only when the caller is a member (0 otherwise), via SECURITY
// DEFINER so it is safe to call before quota reservation under the uploader's RLS.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
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
        SELECT 1 FROM household_member hm
        WHERE hm.household_id = v_household_id AND hm.user_id = p_user_id
      ) THEN
        RETURN QUERY SELECT 'ALREADY_MEMBER'::TEXT, v_household_id;
        RETURN;
      END IF;

      SELECT count(*) INTO v_count
      FROM household_member hm
      WHERE hm.household_id = v_household_id;
      IF v_count >= 3 THEN
        RETURN QUERY SELECT 'FULL'::TEXT, v_household_id;
        RETURN;
      END IF;

      INSERT INTO household_member (household_id, user_id) VALUES (v_household_id, p_user_id);
      RETURN QUERY SELECT 'OK'::TEXT, v_household_id;
    END;
    $$;
    REVOKE ALL ON FUNCTION accept_household_invite(TEXT, UUID) FROM PUBLIC;

    -- Member count of a household, but only for a caller that belongs to it (0
    -- otherwise). Gates the shared upload pool without leaking other households.
    CREATE OR REPLACE FUNCTION household_member_count_for(p_household_id UUID, p_user_id UUID)
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT CASE
        WHEN EXISTS (
          SELECT 1 FROM household_member
          WHERE household_id = p_household_id AND user_id = p_user_id
        )
        THEN (SELECT count(*)::int FROM household_member WHERE household_id = p_household_id)
        ELSE 0
      END;
    $$;
    REVOKE ALL ON FUNCTION household_member_count_for(UUID, UUID) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS household_member_count_for(UUID, UUID);

    -- Restore the 5-member cap (the prior shipped definition).
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
        SELECT 1 FROM household_member hm
        WHERE hm.household_id = v_household_id AND hm.user_id = p_user_id
      ) THEN
        RETURN QUERY SELECT 'ALREADY_MEMBER'::TEXT, v_household_id;
        RETURN;
      END IF;

      SELECT count(*) INTO v_count
      FROM household_member hm
      WHERE hm.household_id = v_household_id;
      IF v_count >= 5 THEN
        RETURN QUERY SELECT 'FULL'::TEXT, v_household_id;
        RETURN;
      END IF;

      INSERT INTO household_member (household_id, user_id) VALUES (v_household_id, p_user_id);
      RETURN QUERY SELECT 'OK'::TEXT, v_household_id;
    END;
    $$;
    REVOKE ALL ON FUNCTION accept_household_invite(TEXT, UUID) FROM PUBLIC;
  `);
}
