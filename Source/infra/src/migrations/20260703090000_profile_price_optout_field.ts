import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- The Settings page (epic 14a) needs the current opt-out state to render its
    -- toggle; GET /me/profile didn't carry it even though the column and the write
    -- path (PUT /me/price-contribution-optout) already existed. Carries region_code
    -- forward unchanged from 20260617110000_invoice_location_gate.ts — a DROP/CREATE
    -- must restate every existing column, not just the new one.
    -- RETURNS TABLE signature changes require DROP before CREATE.
    DROP FUNCTION IF EXISTS get_user_profile(TEXT);

    CREATE FUNCTION get_user_profile(p_cognito_sub TEXT)
    RETURNS TABLE (
      full_name                  TEXT,
      country_code               CHAR(2),
      region_code                TEXT,
      language                   VARCHAR(5),
      home_currency              CHAR(3),
      birthdate                  DATE,
      onboarded                  BOOLEAN,
      role                       TEXT,
      status                     TEXT,
      price_contribution_optout  BOOLEAN
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT full_name, country_code, region_code, language, home_currency, birthdate,
             (onboarded_at IS NOT NULL) AS onboarded,
             role::text   AS role,
             status::text AS status,
             price_contribution_optout
      FROM app_user
      WHERE cognito_sub = p_cognito_sub
      LIMIT 1;
    $$;

    REVOKE ALL ON FUNCTION get_user_profile(TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Restores the exact signature live immediately before this migration's up()
    -- (20260617110000_invoice_location_gate.ts's version, region_code included) —
    -- not an older one, so a rollback doesn't reintroduce the region_code regression.
    DROP FUNCTION IF EXISTS get_user_profile(TEXT);

    CREATE FUNCTION get_user_profile(p_cognito_sub TEXT)
    RETURNS TABLE (
      full_name     TEXT,
      country_code  CHAR(2),
      region_code   TEXT,
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
      SELECT full_name, country_code, region_code, language, home_currency, birthdate,
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
