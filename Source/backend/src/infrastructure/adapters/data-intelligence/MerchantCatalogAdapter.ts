import type { Pool, PoolClient } from 'pg';
import type { IMerchantCatalog, MerchantAliasMatch, MerchantBrandCandidate, WriteMerchantAliasInput } from '@core/ports/data-intelligence/IMerchantCatalog';

interface AliasRow {
  merchant_id: string;
  brand_name: string;
  sim: string;
  default_category_id: string | null;
}

const toMatch = (row: AliasRow): MerchantAliasMatch => ({
  merchantId: row.merchant_id,
  brandName: row.brand_name,
  similarity: parseFloat(row.sim),
  defaultCategoryId: row.default_category_id,
});

// §6.2 merchant catalog over the global merchant/merchant_alias tables (no RLS).
export class MerchantCatalogAdapter implements IMerchantCatalog {
  constructor(private readonly db: Pool | PoolClient) {}

  async findExactAlias(normalized: string, countryCode: string): Promise<MerchantAliasMatch | null> {
    const result = await this.db.query<AliasRow>(
      `SELECT a.merchant_id, m.brand_name, m.default_category_id, '1'::text AS sim
       FROM merchant_alias a JOIN merchant m ON m.id = a.merchant_id
       WHERE a.alias_normalized = $1 AND a.country_code = $2
       LIMIT 1`,
      [normalized, countryCode],
    );
    return result.rows[0] ? toMatch(result.rows[0]) : null;
  }

  async findFuzzyAliases(normalized: string, countryCode: string, limit: number): Promise<MerchantAliasMatch[]> {
    const result = await this.db.query<AliasRow>(
      `SELECT a.merchant_id, m.brand_name, m.default_category_id,
              similarity(a.alias_normalized, $1)::text AS sim
       FROM merchant_alias a JOIN merchant m ON m.id = a.merchant_id
       WHERE a.country_code = $2 AND a.alias_normalized % $1
       ORDER BY sim DESC
       LIMIT $3`,
      [normalized, countryCode, limit],
    );
    return result.rows.map(toMatch);
  }

  // Brand-level word-similarity match: lets the LLM fallback see existing brands even when
  // the alias search missed an over-captured receipt header (e.g.
  // "ALBERT HEIJN XL EINDHOVEN WINKELCENTRUM WOENSEL"). word_similarity (<%) compares the
  // short brand against the best extent of the long blob, so a brand contained in the header
  // scores high — unlike symmetric similarity, whose denominator the extra tokens inflate.
  async findBrandCandidates(normalized: string, countryCode: string, limit: number): Promise<MerchantBrandCandidate[]> {
    const result = await this.db.query<{ id: string; brand_name: string }>(
      `SELECT m.id, m.brand_name
       FROM merchant m
       WHERE m.country_code = $2 AND m.brand_name <% $1
       ORDER BY word_similarity(m.brand_name, $1) DESC
       LIMIT $3`,
      [normalized, countryCode, limit],
    );
    return result.rows.map(row => ({ merchantId: row.id, brandName: row.brand_name }));
  }

  async createProvisionalMerchant(brandName: string, countryCode: string, defaultCategoryId: string | null): Promise<string> {
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO merchant (brand_name, country_code, default_category_id, created_via, status)
       VALUES ($1, $2, $3, 'AUTO', 'PROVISIONAL')
       ON CONFLICT (brand_name, country_code) DO NOTHING
       RETURNING id`,
      [brandName, countryCode, defaultCategoryId],
    );
    if (inserted.rows[0]) return inserted.rows[0].id;

    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM merchant WHERE brand_name = $1 AND country_code = $2 LIMIT 1`,
      [brandName, countryCode],
    );
    return existing.rows[0].id;
  }

  async writeAlias(input: WriteMerchantAliasInput): Promise<void> {
    await this.db.query(
      `INSERT INTO merchant_alias (merchant_id, alias_raw, alias_normalized, country_code, match_count, source)
       VALUES ($1, $2, $3, $4, 1, $5)
       ON CONFLICT (alias_normalized, country_code)
       DO UPDATE SET match_count = merchant_alias.match_count + 1, last_seen_at = now()`,
      [input.merchantId, input.aliasRaw, input.aliasNormalized, input.countryCode, input.source],
    );
  }

  async getDefaultCategory(merchantId: string): Promise<string | null> {
    const result = await this.db.query<{ default_category_id: string | null }>(
      `SELECT default_category_id FROM merchant WHERE id = $1`,
      [merchantId],
    );
    return result.rows[0]?.default_category_id ?? null;
  }
}
