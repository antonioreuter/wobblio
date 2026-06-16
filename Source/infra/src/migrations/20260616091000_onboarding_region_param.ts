import type { MigrationBuilder } from 'node-pg-migrate';

// Onboarding now captures an explicit ISO 3166-2 region (country-driven
// state/province dropdown) instead of deriving a hardcoded NL province. Replace
// the 7-arg function with an 8-arg version that stores the passed region code.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS complete_user_onboarding(TEXT, TEXT, CHAR(2), VARCHAR(5), CHAR(3), DATE, BOOLEAN);

    CREATE OR REPLACE FUNCTION complete_user_onboarding(
      p_cognito_sub TEXT,
      p_full_name   TEXT,
      p_country     CHAR(2),
      p_region_code TEXT,
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
      v_id UUID;
    BEGIN
      UPDATE app_user
         SET full_name       = p_full_name,
             country_code    = p_country,
             language        = p_language,
             home_currency   = p_currency,
             region_code     = COALESCE(NULLIF(p_region_code, ''), p_country),
             birthdate       = p_birthdate,
             onboarded_at    = now(),
             gdpr_consent_at = CASE WHEN p_consent THEN now() ELSE gdpr_consent_at END
       WHERE cognito_sub = p_cognito_sub
      RETURNING id INTO v_id;

      RETURN v_id;
    END;
    $$;

    REVOKE ALL ON FUNCTION complete_user_onboarding(TEXT, TEXT, CHAR(2), TEXT, VARCHAR(5), CHAR(3), DATE, BOOLEAN) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS complete_user_onboarding(TEXT, TEXT, CHAR(2), TEXT, VARCHAR(5), CHAR(3), DATE, BOOLEAN);

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
        WHEN 'NL' THEN 'NL-NB'
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

    REVOKE ALL ON FUNCTION complete_user_onboarding(TEXT, TEXT, CHAR(2), VARCHAR(5), CHAR(3), DATE, BOOLEAN) FROM PUBLIC;
  `);
}
