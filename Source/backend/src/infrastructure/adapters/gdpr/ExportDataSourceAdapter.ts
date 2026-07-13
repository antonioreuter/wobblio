import type { Pool, PoolClient } from 'pg';
import type {
  IExportDataSource,
  ExportAccount,
  ReceiptImageRef,
} from '@core/ports/gdpr/IExportDataSource';
import { UserNotFoundError } from '@core/domain/errors';

// Explicit, human-readable column lists only — never a reuse of the feature repositories
// (InvoiceRepositoryAdapter, etc.), which carry internal fields that must never leak into a
// GDPR export (system_fault_reason, alert flags, quota-pool internals, ...).
export class ExportDataSourceAdapter implements IExportDataSource {
  constructor(private readonly pool: Pool | PoolClient) {}

  async getAccount(tenantId: string): Promise<ExportAccount> {
    const result = await this.pool.query(
      `SELECT full_name, email, country_code, language, home_currency, created_at, price_contribution_optout
       FROM app_user WHERE id = $1`,
      [tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new UserNotFoundError(tenantId);
    return {
      fullName: row.full_name,
      email: row.email,
      country: row.country_code,
      language: row.language,
      currency: row.home_currency,
      createdAt: row.created_at,
      priceContributionOptout: row.price_contribution_optout,
    };
  }

  async listInvoices(tenantId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT i.id, m.brand_name AS merchant, i.transaction_date, i.currency, i.total,
              i.total_home_currency, i.category_id, i.status, i.created_at
       FROM invoice i
       LEFT JOIN merchant m ON m.id = i.merchant_id
       WHERE i.tenant_id = $1
       ORDER BY i.created_at`,
      [tenantId],
    );
    return result.rows;
  }

  async listInvoiceLines(tenantId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT il.id, il.invoice_id, il.raw_text, p.display_name AS product, il.quantity,
              il.pack_quantity, il.base_unit, il.size_source, il.unit_price,
              il.line_total, il.is_discount, il.is_deposit_or_fee
       FROM invoice_line il
       JOIN invoice i ON i.id = il.invoice_id
       LEFT JOIN product p ON p.id = il.product_id
       WHERE i.tenant_id = $1
       ORDER BY il.invoice_id`,
      [tenantId],
    );
    return result.rows;
  }

  async listShoppingLists(tenantId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT sl.id, sl.name, sl.is_active, sl.created_at, sl.completed_at,
              COALESCE(items.item_count, 0) AS item_count
       FROM shopping_list sl
       LEFT JOIN LATERAL (
         SELECT count(*) AS item_count FROM shopping_list_item WHERE list_id = sl.id
       ) items ON true
       WHERE sl.tenant_id = $1
       ORDER BY sl.created_at`,
      [tenantId],
    );
    return result.rows;
  }

  async listBudgets(tenantId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT id, scope, category_id, member_user_id, amount, period, accumulated, cycle_start
       FROM budget WHERE tenant_id = $1
       ORDER BY cycle_start`,
      [tenantId],
    );
    return result.rows;
  }

  async listReceiptImageKeys(tenantId: string): Promise<ReceiptImageRef[]> {
    const result = await this.pool.query<{ id: string; image_s3_key: string }>(
      `SELECT id, image_s3_key FROM invoice WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows.map((row) => ({ invoiceId: row.id, imageS3Key: row.image_s3_key }));
  }
}
