import type { MigrationBuilder } from 'node-pg-migrate';

// Two concerns, both required for the failure-refund + admin-quota features to work:
//
// 1. UPLOAD_FAILURE_REFUNDS counter: the ingestion worker tracks how many failed
//    uploads it has already refunded this week so the refund stays capped. Without
//    the enum value, every refund write throws "invalid input value for enum" and
//    rolls back the whole markInvoiceFailed transaction (status flip included).
//
// 2. Admin quota management crosses tenant boundaries (an operator adjusts another
//    user's weekly counter), so quota_counter RLS would hide the target rows and
//    reject the writes. These SECURITY DEFINER helpers run as the function owner
//    (wobblio_app, the DB owner) and bypass RLS — the same mechanism used by
//    resolve_app_user_by_cognito_sub and compute_budget_spend.
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Not used inside this transaction, so ADD VALUE is safe on PG 15.
  pgm.sql(`ALTER TYPE quota_counter_type ADD VALUE IF NOT EXISTS 'UPLOAD_FAILURE_REFUNDS';`);

  pgm.sql(`
    -- app_user RLS is id = current_tenant_id, so an admin (whose tenant context is
    -- their own id) cannot search other users by a plain SELECT. These helpers run
    -- as owner to back the admin quota console.
    CREATE OR REPLACE FUNCTION admin_search_users_by_email(p_email TEXT)
    RETURNS TABLE (id UUID, email TEXT, role TEXT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT id, email, role::text
      FROM app_user
      WHERE email ILIKE '%' || p_email || '%'
      ORDER BY email
      LIMIT 20;
    $$;
    REVOKE ALL ON FUNCTION admin_search_users_by_email(TEXT) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION admin_get_user(p_user_id UUID)
    RETURNS TABLE (email TEXT, role TEXT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT email, role::text FROM app_user WHERE id = p_user_id;
    $$;
    REVOKE ALL ON FUNCTION admin_get_user(UUID) FROM PUBLIC;

    -- Current weekly UPLOADS used for a batch of users (admin search view).
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

    -- Grant (positive) or revoke (negative) weekly upload scans for one user.
    -- A positive grant FREES scans by decrementing the used counter; the result is
    -- clamped at 0 and the resulting used count is returned.
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

// Enum values cannot be removed in PostgreSQL, so the down path only drops the
// admin helpers; the UPLOAD_FAILURE_REFUNDS value remains and is harmless.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_grant_personal_uploads(UUID, DATE, INT);
    DROP FUNCTION IF EXISTS admin_personal_upload_used(UUID[], DATE);
    DROP FUNCTION IF EXISTS admin_get_user(UUID);
    DROP FUNCTION IF EXISTS admin_search_users_by_email(TEXT);
  `);
}
