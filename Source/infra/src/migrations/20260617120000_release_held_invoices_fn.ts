import type { MigrationBuilder } from 'node-pg-migrate';

// Release path for the invoice location gate (§6.5). Invoices held HELD_UNMAPPED
// (the user confirmed an area not yet in the reference tables) must not be stranded:
// once their region is mapped, a cron re-emits their deferred price observations.
//
// Discovery runs cross-tenant, so it is a SECURITY DEFINER helper that bypasses RLS
// on invoice (the same mechanism as the waitlist/onboarding helpers). It returns only
// the held invoices whose stored location is now mapped — matching isMappedLocation:
// a known subdivision, or a country that has no subdivisions at all. The cron then
// sets each invoice's tenant context and re-emits via the normal RLS-scoped path.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION list_releasable_held_invoices(p_limit INT)
    RETURNS TABLE (invoice_id UUID, tenant_id UUID, country_code CHAR(2), region_code TEXT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT i.id, i.tenant_id, i.location_country_code, i.location_region_code
      FROM invoice i
      WHERE i.location_status = 'HELD_UNMAPPED'
        AND i.status IN ('PARSED', 'NEEDS_REVIEW')
        AND i.location_country_code IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM country_subdivision cs
            WHERE cs.code = i.location_region_code
              AND cs.country_code = i.location_country_code
          )
          OR (
            EXISTS (SELECT 1 FROM country c WHERE c.code = i.location_country_code)
            AND NOT EXISTS (
              SELECT 1 FROM country_subdivision cs WHERE cs.country_code = i.location_country_code
            )
          )
        )
      ORDER BY i.created_at
      LIMIT p_limit;
    $$;

    REVOKE ALL ON FUNCTION list_releasable_held_invoices(INT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS list_releasable_held_invoices(INT);`);
}
