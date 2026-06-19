import type { Pool, PoolClient } from 'pg';
import type {
  IRegionReference,
  ReferenceCountry,
  ReferenceSubdivision,
  RawLocation,
  ResolvedLocation,
} from '@core/ports/data-intelligence/IRegionReference';

// Below this pg_trgm similarity a region-name match is too weak to trust as an
// auto-resolution; the region degrades to null and the user confirms it.
const REGION_NAME_SIMILARITY_FLOOR = 0.4;

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

  async resolveReceiptLocation(input: RawLocation): Promise<ResolvedLocation> {
    const countryCode = await this.resolveCountry(input.countryCode);
    if (!countryCode) return { countryCode: null, regionCode: null };
    const regionCode = await this.resolveRegion(countryCode, input.regionText);
    return { countryCode, regionCode };
  }

  // Returns the canonical alpha-2 only when it exists in `country`.
  private async resolveCountry(raw: string | undefined): Promise<string | null> {
    const code = raw?.trim().toUpperCase();
    if (!code || code.length !== 2) return null;
    const result = await this.db.query(`SELECT 1 FROM country WHERE code = $1 LIMIT 1`, [code]);
    return result.rowCount && result.rowCount > 0 ? code : null;
  }

  // Exact ISO 3166-2 code first, then the best pg_trgm name match above the floor.
  private async resolveRegion(countryCode: string, regionText: string | undefined): Promise<string | null> {
    const text = regionText?.trim();
    if (!text) return null;

    const exact = await this.db.query<{ code: string }>(
      `SELECT code FROM country_subdivision WHERE country_code = $1 AND code = $2 LIMIT 1`,
      [countryCode, text.toUpperCase()],
    );
    if (exact.rows[0]) return exact.rows[0].code;

    const fuzzy = await this.db.query<{ code: string }>(
      `SELECT code FROM country_subdivision
       WHERE country_code = $1 AND similarity(name, $2) >= $3
       ORDER BY similarity(name, $2) DESC
       LIMIT 1`,
      [countryCode, text, REGION_NAME_SIMILARITY_FLOOR],
    );
    return fuzzy.rows[0]?.code ?? null;
  }
}
