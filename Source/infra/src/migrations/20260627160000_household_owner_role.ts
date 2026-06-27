import type { MigrationBuilder } from 'node-pg-migrate';

// A household member cannot read the owner's app_user row under RLS (the app_user
// tenant_isolation policy restricts each tenant to its own row). The upload-quota
// matrix (§2.4) makes the household pool follow the OWNER's role — an operator-role
// owner (TESTER/ADMIN, unlimited personal cap) lifts the household to unlimited — so
// members need the owner's role to compute the pool cap. This SECURITY DEFINER helper
// returns it, but only when the caller is actually a member of the household (same
// guard style as household_member_count_for / list_household_members).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION household_owner_role(p_household_id UUID, p_user_id UUID)
    RETURNS TEXT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT u.role
      FROM household h
      JOIN app_user u ON u.id = h.owner_user_id
      WHERE h.id = p_household_id
        AND EXISTS (
          SELECT 1 FROM household_member m
          WHERE m.household_id = p_household_id AND m.user_id = p_user_id
        );
    $$;

    REVOKE ALL ON FUNCTION household_owner_role(UUID, UUID) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS household_owner_role(UUID, UUID);`);
}
