import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Profile fields captured during post-sign-in onboarding.
    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS birthdate        DATE;
    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS onboarded_at     TIMESTAMPTZ;
    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS gdpr_consent_at  TIMESTAMPTZ;

    -- Self-service onboarding write. SECURITY DEFINER so the call succeeds
    -- without per-request RLS tenant context (mirrors provision_new_user); the
    -- row is located by the authenticated cognito_sub, never client input.
    CREATE OR REPLACE FUNCTION complete_user_onboarding(
      p_cognito_sub TEXT,
      p_full_name   TEXT,
      p_country     CHAR(2),
      p_language    VARCHAR(5),
      p_currency    CHAR(3),
      p_birthdate   DATE,
      p_consent     BOOLEAN
    )
    RETURNS UUID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_id     UUID;
      v_region TEXT;
    BEGIN
      v_region := CASE p_country
        WHEN 'NL' THEN 'NL-NB'   -- North Brabant / Eindhoven, launch market
        ELSE p_country
      END;

      UPDATE app_user
         SET full_name       = p_full_name,
             country_code    = p_country,
             language        = p_language,
             home_currency   = p_currency,
             region_code     = v_region,
             birthdate       = p_birthdate,
             onboarded_at    = now(),
             gdpr_consent_at = CASE WHEN p_consent THEN now() ELSE gdpr_consent_at END
       WHERE cognito_sub = p_cognito_sub
      RETURNING id INTO v_id;

      RETURN v_id;
    END;
    $$;

    -- Profile read for GET /me/profile. SECURITY DEFINER so it works on the
    -- pool connection before any RLS tenant context (same rationale as
    -- resolve_app_user_by_cognito_sub).
    CREATE OR REPLACE FUNCTION get_user_profile(p_cognito_sub TEXT)
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

    REVOKE ALL ON FUNCTION complete_user_onboarding(TEXT, TEXT, CHAR(2), VARCHAR(5), CHAR(3), DATE, BOOLEAN) FROM PUBLIC;
    REVOKE ALL ON FUNCTION get_user_profile(TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS get_user_profile(TEXT);
    DROP FUNCTION IF EXISTS complete_user_onboarding(TEXT, TEXT, CHAR(2), VARCHAR(5), CHAR(3), DATE, BOOLEAN);
    ALTER TABLE app_user DROP COLUMN IF EXISTS gdpr_consent_at;
    ALTER TABLE app_user DROP COLUMN IF EXISTS onboarded_at;
    ALTER TABLE app_user DROP COLUMN IF EXISTS birthdate;
  `);
}
