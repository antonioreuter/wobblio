import type { MigrationBuilder } from 'node-pg-migrate';

// Household mid-week credit carry-over (Non-Functional 02 §6.3). Forming or dissolving
// a household mid-week must not reset already-consumed credits, so two transitions move
// `used` across the owner↔household tenant boundary:
//
//   • Pool activates (2nd member joins): the shared HOUSEHOLD_CREDITS counter inherits
//     the owner's personal CREDITS for the week. The joining member cannot read the
//     owner's counter under RLS, hence SECURITY DEFINER. Overwrite (not add) so a
//     re-activation after a prior settle starts from the owner's current spend.
//   • Pool deactivates (last member leaves / removed / disband): the owner re-absorbs
//     the pool's spend via GREATEST, so dissolving never wipes consumption (and keeps
//     the owner's own frozen personal spend when it is the larger of the two).
//
// Both are single atomic statements; the TypeScript carry-over service only decides
// which one fires (from member counts). week_start is passed in by the caller so the
// boundary always matches domain/week.ts (Monday-UTC), never the DB session timezone.
// EXECUTE is reconciled to the runtime role by deploy (GRANT EXECUTE ON ALL FUNCTIONS).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION carry_over_household_pool_on_activate(
      p_household_id UUID,
      p_week_start   DATE
    )
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      INSERT INTO quota_counter (tenant_id, counter, week_start, used)
      SELECT p_household_id, 'HOUSEHOLD_CREDITS', p_week_start,
             COALESCE((
               SELECT used FROM quota_counter
               WHERE tenant_id = (SELECT owner_user_id FROM household WHERE id = p_household_id)
                 AND counter = 'CREDITS'
                 AND week_start = p_week_start
             ), 0)
      ON CONFLICT (tenant_id, counter, week_start)
      DO UPDATE SET used = EXCLUDED.used;
    $$;
    REVOKE ALL ON FUNCTION carry_over_household_pool_on_activate(UUID, DATE) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION settle_household_pool_to_owner(
      p_household_id UUID,
      p_week_start   DATE
    )
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      INSERT INTO quota_counter (tenant_id, counter, week_start, used)
      SELECT h.owner_user_id, 'CREDITS', p_week_start,
             COALESCE((
               SELECT used FROM quota_counter
               WHERE tenant_id = p_household_id
                 AND counter = 'HOUSEHOLD_CREDITS'
                 AND week_start = p_week_start
             ), 0)
      FROM household h
      WHERE h.id = p_household_id
      ON CONFLICT (tenant_id, counter, week_start)
      DO UPDATE SET used = GREATEST(quota_counter.used, EXCLUDED.used);
    $$;
    REVOKE ALL ON FUNCTION settle_household_pool_to_owner(UUID, DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS settle_household_pool_to_owner(UUID, DATE);
    DROP FUNCTION IF EXISTS carry_over_household_pool_on_activate(UUID, DATE);
  `);
}
