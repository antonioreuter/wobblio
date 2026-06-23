import type { PoolClient } from 'pg';
import type {
  ICatalogCurationRepository,
  ProvisionalEntity,
  CatalogStatus,
} from '@core/ports/data-intelligence/ICatalogCurationRepository';

interface QueueRow {
  id: string;
  name: string;
  subtitle: string | null;
  aliases: string[];
  tenant_count: string;
  observation_count: string;
}

// Global merchant/product catalog (no RLS). Provisional queues come from the
// SECURITY DEFINER helpers (cross-tenant counts); status/merge are plain UPDATEs.
export class CatalogCurationAdapter implements ICatalogCurationRepository {
  constructor(private readonly db: PoolClient) {}

  async listProvisionalMerchants(): Promise<ProvisionalEntity[]> {
    const result = await this.db.query<QueueRow>(
      `SELECT id, name, country_code AS subtitle, aliases, tenant_count, observation_count
       FROM admin_provisional_merchants()`,
    );
    return result.rows.map(toEntity);
  }

  async listProvisionalProducts(): Promise<ProvisionalEntity[]> {
    const result = await this.db.query<QueueRow>(
      `SELECT id, name, brand AS subtitle, aliases, tenant_count, observation_count
       FROM admin_provisional_products()`,
    );
    return result.rows.map(toEntity);
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
    aliases: row.aliases ?? [],
    tenantCount: Number(row.tenant_count),
    observationCount: Number(row.observation_count),
  };
}
