import type { Pool, PoolClient } from 'pg';
import type { IRegionReference, ReferenceCountry, ReferenceSubdivision } from '@core/ports/data-intelligence/IRegionReference';

// ISO 3166 reference reads over the global country / country_subdivision tables.
export class RegionReferenceAdapter implements IRegionReference {
  constructor(private readonly db: Pool | PoolClient) {}

  async listCountries(): Promise<ReferenceCountry[]> {
    const result = await this.db.query<{ code: string; name: string }>(
      `SELECT code, name FROM country ORDER BY name`,
    );
    return result.rows;
  }

  async listSubdivisions(countryCode: string): Promise<ReferenceSubdivision[]> {
    const result = await this.db.query<{ code: string; country_code: string; name: string }>(
      `SELECT code, country_code, name FROM country_subdivision WHERE country_code = $1 ORDER BY name`,
      [countryCode],
    );
    return result.rows.map(r => ({ code: r.code, countryCode: r.country_code, name: r.name }));
  }

  async isValidRegion(countryCode: string, regionCode: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM country_subdivision WHERE code = $1 AND country_code = $2 LIMIT 1`,
      [regionCode, countryCode],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  // A location is mapped only when its exact subdivision exists in reference data.
  // A country whose subdivisions aren't seeded yet is treated as UNMAPPED so its
  // invoices stay HELD rather than emitting against an unmapped region (§6.5 gate).
  async isMappedLocation(countryCode: string, regionCode: string): Promise<boolean> {
    return this.isValidRegion(countryCode, regionCode);
  }
}
