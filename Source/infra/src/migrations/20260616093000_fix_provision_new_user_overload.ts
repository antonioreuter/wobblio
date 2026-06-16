import type { MigrationBuilder } from 'node-pg-migrate';

// Migration 20260612120000 meant to REPLACE provision_new_user with a 7-arg version
// (profile params, all defaulted) but, because it changed the argument list,
// CREATE OR REPLACE added a second overload instead of replacing the original 3-arg
// one. Two overloads + defaults on the 7-arg version make a 3-arg call ambiguous
// ("function provision_new_user(...) is not unique"). Drop the stale 3-arg overload;
// 3-arg callers then resolve cleanly to the 7-arg version via its defaults.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS provision_new_user(TEXT, TEXT, user_status);`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION provision_new_user(
      p_cognito_sub TEXT,
      p_email       TEXT,
      p_status      user_status
    )
    RETURNS UUID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_id UUID;
    BEGIN
      INSERT INTO app_user (cognito_sub, email, role, status)
      VALUES (p_cognito_sub, p_email, 'STANDARD', p_status)
      ON CONFLICT (cognito_sub) DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NULL THEN
        SELECT id INTO v_id FROM app_user WHERE cognito_sub = p_cognito_sub;
      END IF;
      RETURN v_id;
    END;
    $$;

    REVOKE ALL ON FUNCTION provision_new_user(TEXT, TEXT, user_status) FROM PUBLIC;
  `);
}
