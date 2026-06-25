import type { MigrationBuilder } from 'node-pg-migrate';

// accept_household_invite declares RETURNS TABLE (..., household_id UUID). That
// output column shadows the household_member.household_id table column, so the
// unqualified `WHERE household_id = v_household_id` references inside the function
// raise Postgres 42702 ("column reference is ambiguous") the moment a real accept
// runs (the unit tests mock the repo, so the SQL was never exercised). Qualify the
// table columns with an alias to disambiguate. Logic is otherwise unchanged.
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

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Restore the prior (ambiguous) definition so the migration is a true inverse.
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
  `);
}
