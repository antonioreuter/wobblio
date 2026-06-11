import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Seed waitlist counter (free_user_count already seeded in initial schema migration)
    INSERT INTO system_counter (name, value) VALUES ('waitlist_count', 0);

    -- ── SECURITY DEFINER helpers ─────────────────────────────────────────────────
    -- These functions run as the DB owner, bypassing RLS on app_user.
    -- They are the ONLY mechanism for privileged app_user operations.
    -- All functions REVOKE PUBLIC EXECUTE to limit surface area.

    -- Lookup by cognito_sub — used by api-handler for tenant context bootstrap.
    -- RLS on app_user blocks a plain SELECT before tenant context is set;
    -- this function runs with owner privileges to break the circular dependency.
    CREATE OR REPLACE FUNCTION resolve_app_user_by_cognito_sub(p_cognito_sub TEXT)
    RETURNS TABLE (
      id          UUID,
      cognito_sub TEXT,
      email       TEXT,
      role        user_role,
      status      user_status
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT id, cognito_sub, email, role, status
      FROM app_user
      WHERE cognito_sub = p_cognito_sub
      LIMIT 1;
    $$;

    -- Provision new user — used by post-confirmation hook.
    -- Role is always STANDARD; status is passed by the caller based on counter result.
    -- ON CONFLICT DO NOTHING makes this idempotent against duplicate Cognito deliveries.
    -- Also increments waitlist_count when status is WAITLIST.
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

      IF p_status = 'WAITLIST' THEN
        UPDATE system_counter SET value = value + 1 WHERE name = 'waitlist_count';
      END IF;

      RETURN v_id;
    END;
    $$;

    -- FIFO batch of waitlisted users — used by cron-waitlist-release.
    CREATE OR REPLACE FUNCTION get_waitlisted_batch(p_limit INT)
    RETURNS TABLE (id UUID, email TEXT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT id, email
      FROM app_user
      WHERE status = 'WAITLIST'
      ORDER BY created_at
      LIMIT p_limit;
    $$;

    -- Activate released users and adjust both counters atomically — used by cron.
    -- Only activates rows that are still WAITLIST (guards against concurrent releases).
    -- Returns the count of rows actually activated.
    CREATE OR REPLACE FUNCTION release_waitlisted_users(p_user_ids UUID[])
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      UPDATE app_user
      SET status = 'ACTIVE'
      WHERE id = ANY(p_user_ids)
        AND status = 'WAITLIST';

      GET DIAGNOSTICS v_count = ROW_COUNT;

      IF v_count > 0 THEN
        UPDATE system_counter SET value = value + v_count       WHERE name = 'free_user_count';
        UPDATE system_counter SET value = GREATEST(0, value - v_count) WHERE name = 'waitlist_count';
      END IF;

      RETURN v_count;
    END;
    $$;

    -- Harden: revoke public execute on all privileged functions
    REVOKE ALL ON FUNCTION resolve_app_user_by_cognito_sub(TEXT)            FROM PUBLIC;
    REVOKE ALL ON FUNCTION provision_new_user(TEXT, TEXT, user_status)      FROM PUBLIC;
    REVOKE ALL ON FUNCTION get_waitlisted_batch(INT)                        FROM PUBLIC;
    REVOKE ALL ON FUNCTION release_waitlisted_users(UUID[])                 FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS release_waitlisted_users(UUID[]);
    DROP FUNCTION IF EXISTS get_waitlisted_batch(INT);
    DROP FUNCTION IF EXISTS provision_new_user(TEXT, TEXT, user_status);
    DROP FUNCTION IF EXISTS resolve_app_user_by_cognito_sub(TEXT);
    DELETE FROM system_counter WHERE name = 'waitlist_count';
  `);
}
