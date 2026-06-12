import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Add full display name (single field replaces given_name/family_name split)
    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';

    -- Widen language column from CHAR(2) to VARCHAR(5) to support locale codes like 'pt-BR'
    ALTER TABLE app_user ALTER COLUMN language TYPE VARCHAR(5);

    -- Replace provision_new_user with an updated signature that accepts profile fields.
    -- All new params have defaults so existing callers without them still work.
    CREATE OR REPLACE FUNCTION provision_new_user(
      p_cognito_sub TEXT,
      p_email       TEXT,
      p_status      user_status,
      p_full_name   TEXT        DEFAULT '',
      p_country     CHAR(2)     DEFAULT 'NL',
      p_language    VARCHAR(5)  DEFAULT 'nl',
      p_currency    CHAR(3)     DEFAULT 'EUR'
    )
    RETURNS UUID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_id        UUID;
      v_region    TEXT;
    BEGIN
      -- Derive a sensible default region from the country (used by price engine)
      v_region := CASE p_country
        WHEN 'NL' THEN 'NL-NB'   -- North Brabant / Eindhoven, launch market
        ELSE p_country            -- fallback: bare country code
      END;

      INSERT INTO app_user (
        cognito_sub, email, role, status,
        full_name, country_code, language, home_currency, region_code
      )
      VALUES (
        p_cognito_sub, p_email, 'STANDARD', p_status,
        p_full_name, p_country, p_language, p_currency, v_region
      )
      ON CONFLICT (cognito_sub) DO NOTHING
      RETURNING id INTO v_id;

      -- Idempotent: if row already existed, return existing id
      IF v_id IS NULL THEN
        SELECT id INTO v_id FROM app_user WHERE cognito_sub = p_cognito_sub;
      END IF;

      RETURN v_id;
    END;
    $$;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Restore original 3-param provision_new_user
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

    ALTER TABLE app_user ALTER COLUMN language TYPE CHAR(2);
    ALTER TABLE app_user DROP COLUMN IF EXISTS full_name;
  `);
}
