import type { MigrationBuilder } from 'node-pg-migrate';

// Repoint the admin quota helpers from the legacy UPLOADS counter to CREDITS
// (Non-Functional 02 §8). Once the ingestion worker charges the CREDITS counter, an
// admin console still reading UPLOADS would always show 0 used and grant against a
// dead counter. A separate file from the enum migration so it is safe to USE the
// 'CREDITS' value here (it was added in its own transaction).
//
// The bodies are otherwise unchanged: SECURITY DEFINER (runs as the owner to cross the
// quota_counter RLS boundary for cross-tenant admin reads/writes), REVOKE FROM PUBLIC.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION admin_personal_upload_used(p_user_ids UUID[], p_week_start DATE)
    RETURNS TABLE (user_id UUID, used INT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT tenant_id, used
      FROM quota_counter
      WHERE counter = 'CREDITS'
        AND week_start = p_week_start
        AND tenant_id = ANY(p_user_ids);
    $$;
    REVOKE ALL ON FUNCTION admin_personal_upload_used(UUID[], DATE) FROM PUBLIC;

    -- Grant (positive) or revoke (negative) weekly credits for one user. A positive
    -- grant FREES credits by decrementing used; the result is clamped at 0 and the
    -- resulting used count is returned.
    CREATE OR REPLACE FUNCTION admin_grant_personal_uploads(p_user_id UUID, p_week_start DATE, p_granted INT)
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_used INT;
    BEGIN
      INSERT INTO quota_counter (tenant_id, counter, week_start, used)
      VALUES (p_user_id, 'CREDITS', p_week_start, GREATEST(0, -p_granted))
      ON CONFLICT (tenant_id, counter, week_start)
      DO UPDATE SET used = GREATEST(0, quota_counter.used - p_granted)
      RETURNING used INTO v_used;
      RETURN v_used;
    END;
    $$;
    REVOKE ALL ON FUNCTION admin_grant_personal_uploads(UUID, DATE, INT) FROM PUBLIC;
  `);
}

// Restore the prior UPLOADS-based definitions.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION admin_personal_upload_used(p_user_ids UUID[], p_week_start DATE)
    RETURNS TABLE (user_id UUID, used INT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT tenant_id, used
      FROM quota_counter
      WHERE counter = 'UPLOADS'
        AND week_start = p_week_start
        AND tenant_id = ANY(p_user_ids);
    $$;
    REVOKE ALL ON FUNCTION admin_personal_upload_used(UUID[], DATE) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION admin_grant_personal_uploads(p_user_id UUID, p_week_start DATE, p_granted INT)
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_used INT;
    BEGIN
      INSERT INTO quota_counter (tenant_id, counter, week_start, used)
      VALUES (p_user_id, 'UPLOADS', p_week_start, GREATEST(0, -p_granted))
      ON CONFLICT (tenant_id, counter, week_start)
      DO UPDATE SET used = GREATEST(0, quota_counter.used - p_granted)
      RETURNING used INTO v_used;
      RETURN v_used;
    END;
    $$;
    REVOKE ALL ON FUNCTION admin_grant_personal_uploads(UUID, DATE, INT) FROM PUBLIC;
  `);
}
