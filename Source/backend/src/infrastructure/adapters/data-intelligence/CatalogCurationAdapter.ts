import type { PoolClient } from 'pg';
import type {
  ICatalogCurationRepository,
  ProvisionalEntity,
  CatalogStatus,
  QueueFilters,
  CategoryCount,
  CountryCount,
  RegionCount,
} from '@core/ports/data-intelligence/ICatalogCurationRepository';

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

  mergeProduct(sourceId: string, targetId: string): Promise<boolean> {
    return this.merge('product', 'product_id', sourceId, targetId);
  }

  private async updateStatus(table: 'merchant' | 'product', id: string, status: CatalogStatus): Promise<boolean> {
    const result = await this.db.query(`UPDATE ${table} SET status = $2 WHERE id = $1`, [id, status]);
    return (result.rowCount ?? 0) > 0;
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
