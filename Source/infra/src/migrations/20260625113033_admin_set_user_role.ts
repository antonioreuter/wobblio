import type { MigrationBuilder } from 'node-pg-migrate';

// Operator role change for the admin console (invariant #5 deviation: the console
// is the sanctioned "operator" path). app_user RLS is id = current_tenant_id, so an
// admin cannot UPDATE another user's row by a plain statement — this SECURITY
// DEFINER helper runs as owner (wobblio_app) and bypasses RLS, mirroring the other
// admin_* helpers. The p_role::user_role cast raises on an invalid enum value.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION admin_set_user_role(p_user_id UUID, p_role TEXT)
    RETURNS TEXT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_role user_role;
    BEGIN
      v_role := p_role::user_role;
      UPDATE app_user SET role = v_role WHERE id = p_user_id;
      RETURN p_role;
    END;
    $$;
    REVOKE ALL ON FUNCTION admin_set_user_role(UUID, TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS admin_set_user_role(UUID, TEXT);`);
}
