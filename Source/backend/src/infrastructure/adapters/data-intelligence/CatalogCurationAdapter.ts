import type { PoolClient } from 'pg';
import type {
  ICatalogCurationRepository,
  ProvisionalEntity,
  CatalogStatus,
  QueueFilters,
  CategoryCount,
  CountryCount,
  RegionCount,
  MergeProvenance,
  ProductAliasInfo,
} from '@core/ports/data-intelligence/ICatalogCurationRepository';
import type { MergeCompatibility } from '@core/domain/catalogMerge';

interface QueueRow {
  id: string;
  name: string;
  subtitle: string | null;
  category: string | null;
  aliases: string[];
  tenant_count: string;
  observation_count: string;
  last_seen_on: string | null;
}

// Global merchant/product catalog (no RLS). Provisional queues come from the
// SECURITY DEFINER helpers (cross-tenant counts); status/merge are plain UPDATEs.
export class CatalogCurationAdapter implements ICatalogCurationRepository {
  constructor(private readonly db: PoolClient) {}

  async listProvisionalMerchants(filters: QueueFilters): Promise<ProvisionalEntity[]> {
    return this.listProvisional('admin_provisional_merchants', filters);
  }

  async listProvisionalProducts(filters: QueueFilters): Promise<ProvisionalEntity[]> {
    return this.listProvisional('admin_provisional_products', filters);
  }

  private async listProvisional(fn: string, f: QueueFilters): Promise<ProvisionalEntity[]> {
    const result = await this.db.query<QueueRow>(
      `SELECT id, name, subtitle, category, aliases, tenant_count, observation_count, last_seen_on
       FROM ${fn}($1, $2, $3, $4, $5, $6)`,
      [f.country, f.region, f.category, f.sort, f.limit, f.offset],
    );
    return result.rows.map(toEntity);
  }

  merchantCountries(): Promise<CountryCount[]> {
    return this.countries('admin_provisional_merchant_countries');
  }

  productCountries(): Promise<CountryCount[]> {
    return this.countries('admin_provisional_product_countries');
  }

  private async countries(fn: string): Promise<CountryCount[]> {
    const result = await this.db.query<{ country_code: string; cnt: string }>(`SELECT country_code, cnt FROM ${fn}()`);
    return result.rows.map((r) => ({ countryCode: r.country_code, count: Number(r.cnt) }));
  }

  merchantCategories(country: string, region: string | null): Promise<CategoryCount[]> {
    return this.categories('admin_provisional_merchant_categories', country, region);
  }

  productCategories(country: string, region: string | null): Promise<CategoryCount[]> {
    return this.categories('admin_provisional_product_categories', country, region);
  }

  private async categories(fn: string, country: string, region: string | null): Promise<CategoryCount[]> {
    const result = await this.db.query<{ category_id: string; category_name: string; cnt: string }>(
      `SELECT category_id, category_name, cnt FROM ${fn}($1, $2)`,
      [country, region],
    );
    return result.rows.map((r) => ({ categoryId: r.category_id, categoryName: r.category_name, count: Number(r.cnt) }));
  }

  merchantRegions(country: string): Promise<RegionCount[]> {
    return this.regions('admin_provisional_merchant_regions', country);
  }

  productRegions(country: string): Promise<RegionCount[]> {
    return this.regions('admin_provisional_product_regions', country);
  }

  private async regions(fn: string, country: string): Promise<RegionCount[]> {
    const result = await this.db.query<{ region_code: string; cnt: string }>(
      `SELECT region_code, cnt FROM ${fn}($1)`,
      [country],
    );
    return result.rows.map((r) => ({ regionCode: r.region_code, count: Number(r.cnt) }));
  }

  setMerchantStatus(id: string, status: CatalogStatus): Promise<boolean> {
    return this.updateStatus('merchant', id, status);
  }

  setProductStatus(id: string, status: CatalogStatus): Promise<boolean> {
    return this.updateStatus('product', id, status);
  }

  mergeMerchant(sourceId: string, targetId: string): Promise<boolean> {
    return this.merge('merchant', 'merchant_id', sourceId, targetId);
  }

  // Product merge with B2 provenance: capture which alias rows and how many observations
  // moved onto the target, so a later un-merge / audit can see what changed.
  async mergeProduct(sourceId: string, targetId: string): Promise<MergeProvenance | null> {
    if (sourceId === targetId) return null;
    const target = await this.db.query('SELECT 1 FROM product WHERE id = $1', [targetId]);
    if ((target.rowCount ?? 0) === 0) return null;

    await this.db.query('BEGIN');
    try {
      const aliases = await this.db.query<{ id: string }>(
        'UPDATE product_alias SET product_id = $2 WHERE product_id = $1 RETURNING id',
        [sourceId, targetId],
      );
      const obs = await this.db.query(
        'UPDATE price_observation SET product_id = $2 WHERE product_id = $1',
        [sourceId, targetId],
      );
      const updated = await this.db.query("UPDATE product SET status = 'INACTIVE' WHERE id = $1", [sourceId]);
      if ((updated.rowCount ?? 0) === 0) {
        await this.db.query('ROLLBACK');
        return null;
      }
      await this.db.query('COMMIT');
      return { movedAliasIds: aliases.rows.map((r) => r.id), movedObservationCount: obs.rowCount ?? 0 };
    } catch (err) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw err;
    }
  }

  // pgvector cosine distance (<=>) → similarity = 1 - distance; 0 when an embedding is
  // missing (treated as unverified so the guard refuses). null when either id is missing.
  async getMergeCompatibility(sourceId: string, targetId: string): Promise<MergeCompatibility | null> {
    const result = await this.db.query<{ category_match: boolean; unit_match: boolean; merchant_match: boolean; similarity: number | null }>(
      `SELECT (s.category_id IS NOT DISTINCT FROM t.category_id) AS category_match,
              (s.base_unit = t.base_unit) AS unit_match,
              (s.merchant_id IS NOT DISTINCT FROM t.merchant_id) AS merchant_match,
              CASE WHEN s.embedding IS NULL OR t.embedding IS NULL THEN NULL
                   ELSE 1 - (s.embedding <=> t.embedding) END AS similarity
       FROM product s, product t
       WHERE s.id = $1 AND t.id = $2`,
      [sourceId, targetId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { categoryMatch: row.category_match, unitMatch: row.unit_match, merchantMatch: row.merchant_match, similarity: Number(row.similarity ?? 0) };
  }

  async listProductAliases(productId: string): Promise<ProductAliasInfo[]> {
    const result = await this.db.query<{
      id: string;
      alias_normalized: string;
      merchant_id: string | null;
      source: string;
      match_count: number;
      last_seen_at: string;
    }>(
      `SELECT id, alias_normalized, merchant_id, source, match_count, last_seen_at
       FROM product_alias WHERE product_id = $1 ORDER BY match_count DESC, last_seen_at DESC`,
      [productId],
    );
    return result.rows.map((r) => ({
      id: r.id,
      aliasNormalized: r.alias_normalized,
      merchantId: r.merchant_id,
      source: r.source,
      matchCount: Number(r.match_count),
      lastSeenAt: r.last_seen_at,
    }));
  }

  async deactivateAlias(aliasId: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM product_alias WHERE id = $1', [aliasId]);
    return (result.rowCount ?? 0) > 0;
  }

  private async updateStatus(table: 'merchant' | 'product', id: string, status: CatalogStatus): Promise<boolean> {
    const result = await this.db.query(`UPDATE ${table} SET status = $2 WHERE id = $1`, [id, status]);
    return (result.rowCount ?? 0) > 0;
  }

  releaseProductObservations(productId: string): Promise<void> {
    return this.releaseObservations('po.product_id', productId);
  }

  releaseMerchantObservations(merchantId: string): Promise<void> {
    return this.releaseObservations('po.merchant_id', merchantId);
  }

  // Clear quarantine only for rows whose product AND merchant are both ACTIVE now —
  // checking both current statuses means a row still pending its counterpart stays held.
  private async releaseObservations(keyColumn: 'po.product_id' | 'po.merchant_id', id: string): Promise<void> {
    await this.db.query(
      `UPDATE price_observation po SET quarantined = false
       FROM product p, merchant m
       WHERE po.product_id = p.id AND po.merchant_id = m.id
         AND ${keyColumn} = $1
         AND po.quarantined = true
         AND p.status = 'ACTIVE' AND m.status = 'ACTIVE'`,
      [id],
    );
  }

  async quarantineProductObservations(productId: string): Promise<void> {
    await this.db.query('UPDATE price_observation SET quarantined = true WHERE product_id = $1', [productId]);
  }

  async quarantineMerchantObservations(merchantId: string): Promise<void> {
    await this.db.query('UPDATE price_observation SET quarantined = true WHERE merchant_id = $1', [merchantId]);
  }

  // Retarget alias + observation references from source to target (global tables),
  // then deactivate the source. Atomic; invoice/invoice_line refs (RLS) are left
  // pointing at the now-INACTIVE source — only aliases/observations move (spec 06).
  private async merge(
    table: 'merchant' | 'product',
    fkColumn: 'merchant_id' | 'product_id',
    sourceId: string,
    targetId: string,
  ): Promise<boolean> {
    if (sourceId === targetId) return false;
    const target = await this.db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [targetId]);
    if ((target.rowCount ?? 0) === 0) return false;

    const aliasTable = table === 'merchant' ? 'merchant_alias' : 'product_alias';
    await this.db.query('BEGIN');
    try {
      await this.db.query(`UPDATE ${aliasTable} SET ${fkColumn} = $2 WHERE ${fkColumn} = $1`, [sourceId, targetId]);
      await this.db.query(`UPDATE price_observation SET ${fkColumn} = $2 WHERE ${fkColumn} = $1`, [sourceId, targetId]);
      const updated = await this.db.query(`UPDATE ${table} SET status = 'INACTIVE' WHERE id = $1`, [sourceId]);
      await this.db.query('COMMIT');
      return (updated.rowCount ?? 0) > 0;
    } catch (err) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw err;
    }
  }
}

function toEntity(row: QueueRow): ProvisionalEntity {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    category: row.category,
    aliases: row.aliases ?? [],
    tenantCount: Number(row.tenant_count),
    observationCount: Number(row.observation_count),
    lastSeenOn: row.last_seen_on,
  };
}
