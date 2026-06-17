import type { MigrationBuilder } from 'node-pg-migrate';

// Invoice location quality gate (§6.5). An invoice's price observations are only
// shared into the de-identified Price Observation Store once the invoice has a
// valid, reference-mapped location. The location is resolved from the contributor
// profile at ingestion; when it can't be mapped the invoice is held PENDING and the
// user confirms it once (write-once via location_confirmed_at). Because the store
// carries no invoice reference (rows can't be retracted), emission is DEFERRED until
// the location is valid — hence the provisional flags persisted here let a later
// confirmation rebuild observations faithfully (the quarantine flag depends on them).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      ADD COLUMN location_country_code CHAR(2)     NULL,
      ADD COLUMN location_region_code  TEXT        NULL,
      ADD COLUMN location_status       TEXT        NOT NULL DEFAULT 'PENDING'
        CHECK (location_status IN ('RESOLVED', 'PENDING', 'HELD_UNMAPPED')),
      ADD COLUMN location_source       TEXT        NULL
        CHECK (location_source IS NULL OR location_source IN ('PROFILE', 'USER')),
      ADD COLUMN location_confirmed_at TIMESTAMPTZ NULL,
      ADD COLUMN merchant_provisional  BOOLEAN     NOT NULL DEFAULT false;

    ALTER TABLE invoice_line
      ADD COLUMN product_provisional   BOOLEAN     NOT NULL DEFAULT false;

    -- Historical invoices already past PROCESSING emitted (or were excluded from)
    -- observations under the pre-gate logic; mark them RESOLVED so they don't
    -- spuriously prompt for a location.
    UPDATE invoice SET location_status = 'RESOLVED' WHERE status <> 'PROCESSING';

    -- Surface the home region in the profile read so the location prompt can be
    -- prefilled from the user's onboarding country/region.
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

    ALTER TABLE invoice_line DROP COLUMN product_provisional;

    ALTER TABLE invoice
      DROP COLUMN location_country_code,
      DROP COLUMN location_region_code,
      DROP COLUMN location_status,
      DROP COLUMN location_source,
      DROP COLUMN location_confirmed_at,
      DROP COLUMN merchant_provisional;
  `);
}
