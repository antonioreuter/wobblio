import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION purge_expired_invoice_shares()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      WITH deleted AS (DELETE FROM invoice_share WHERE expires_at < now() RETURNING 1)
      SELECT count(*) INTO v_count FROM deleted;
      RETURN v_count;
    END;
    $$;
    REVOKE ALL ON FUNCTION purge_expired_invoice_shares() FROM PUBLIC;

    CREATE OR REPLACE FUNCTION purge_expired_household_invites()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      WITH deleted AS (DELETE FROM household_invite WHERE expires_at < now() RETURNING 1)
      SELECT count(*) INTO v_count FROM deleted;
      RETURN v_count;
    END;
    $$;
    REVOKE ALL ON FUNCTION purge_expired_household_invites() FROM PUBLIC;

    CREATE OR REPLACE FUNCTION purge_old_ingestion_ledger()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      WITH deleted AS (
        DELETE FROM ingestion_ledger
        WHERE status IN ('PROCESSED', 'FAILED')
          AND created_at < now() - INTERVAL '90 days'
        RETURNING 1
      )
      SELECT count(*) INTO v_count FROM deleted;
      RETURN v_count;
    END;
    $$;
    REVOKE ALL ON FUNCTION purge_old_ingestion_ledger() FROM PUBLIC;

    CREATE OR REPLACE FUNCTION purge_old_quota_counters()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      WITH deleted AS (
        DELETE FROM quota_counter
        WHERE week_start < now()::date - INTERVAL '60 days'
        RETURNING 1
      )
      SELECT count(*) INTO v_count FROM deleted;
      RETURN v_count;
    END;
    $$;
    REVOKE ALL ON FUNCTION purge_old_quota_counters() FROM PUBLIC;

    CREATE OR REPLACE FUNCTION purge_stale_weekly_advisors()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      WITH deleted AS (
        DELETE FROM weekly_advisor
        WHERE generated_at < now() - INTERVAL '4 months'
        RETURNING 1
      )
      SELECT count(*) INTO v_count FROM deleted;
      RETURN v_count;
    END;
    $$;
    REVOKE ALL ON FUNCTION purge_stale_weekly_advisors() FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS purge_expired_invoice_shares();
    DROP FUNCTION IF EXISTS purge_expired_household_invites();
    DROP FUNCTION IF EXISTS purge_old_ingestion_ledger();
    DROP FUNCTION IF EXISTS purge_old_quota_counters();
    DROP FUNCTION IF EXISTS purge_stale_weekly_advisors();
  `);
}
