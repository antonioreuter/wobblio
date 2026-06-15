import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- The webapp session sources name/role/status/onboarded from the DB (not from
    -- Cognito attributes). Extend the profile read to carry role + status so the
    -- jwt callback can populate the session from a single fetch.
    -- RETURNS TABLE signature changes require DROP before CREATE.
    DROP FUNCTION IF EXISTS get_user_profile(TEXT);

    CREATE FUNCTION get_user_profile(p_cognito_sub TEXT)
    RETURNS TABLE (
      full_name     TEXT,
      country_code  CHAR(2),
      language      VARCHAR(5),
      home_currency CHAR(3),
      birthdate     DATE,
      onboarded     BOOLEAN,
      role          TEXT,
      status        TEXT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT full_name, country_code, language, home_currency, birthdate,
             (onboarded_at IS NOT NULL) AS onboarded,
             role::text   AS role,
             status::text AS status
      FROM app_user
      WHERE cognito_sub = p_cognito_sub
      LIMIT 1;
    $$;

    REVOKE ALL ON FUNCTION get_user_profile(TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS get_user_profile(TEXT);

    CREATE FUNCTION get_user_profile(p_cognito_sub TEXT)
    RETURNS TABLE (
      full_name     TEXT,
      country_code  CHAR(2),
      language      VARCHAR(5),
      home_currency CHAR(3),
      birthdate     DATE,
      onboarded     BOOLEAN
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT full_name, country_code, language, home_currency, birthdate,
             (onboarded_at IS NOT NULL) AS onboarded
      FROM app_user
      WHERE cognito_sub = p_cognito_sub
      LIMIT 1;
    $$;

    REVOKE ALL ON FUNCTION get_user_profile(TEXT) FROM PUBLIC;
  `);
}
