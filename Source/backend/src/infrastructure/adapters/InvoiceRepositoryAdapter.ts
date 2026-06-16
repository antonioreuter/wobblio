import type { PoolClient } from 'pg';
import type {
  IInvoiceRepository,
  CreatePendingInvoice,
  InvoiceRecord,
  FuzzyFingerprint,
  PersistParsedInvoice,
  InvoiceListItem,
  InvoiceDetail,
  InvoiceDetailLine,
} from '@core/ports/IInvoiceRepository';
import type { InvoiceStatus } from '@core/domain/ingestion';

interface InvoiceListRow {
  id: string;
  status: InvoiceStatus;
  merchant_name: string | null;
  category_id: string | null;
  transaction_date: string | null;
  total: string | null;
  currency: string | null;
  search_tags: string[];
  created_at: string;
}

const num = (v: string | null): number | null => (v === null ? null : parseFloat(v));

const toListItem = (row: InvoiceListRow): InvoiceListItem => ({
  id: row.id,
  status: row.status,
  merchantName: row.merchant_name,
  categoryId: row.category_id,
  transactionDate: row.transaction_date,
  total: num(row.total),
  currency: row.currency,
  searchTags: row.search_tags,
  createdAt: row.created_at,
});

const LIST_COLUMNS = `
  i.id, i.status, m.brand_name AS merchant_name, i.category_id,
  i.transaction_date::text AS transaction_date, i.total::text AS total,
  i.currency, i.search_tags, i.created_at::text AS created_at`;

interface InvoiceRow {
  id: string;
  tenant_id: string;
  status: InvoiceStatus;
  image_s3_key: string;
  image_sha256: string;
  household_id: string | null;
}

// All methods rely on RLS (app.current_tenant_id) set on this client's transaction.
export class InvoiceRepositoryAdapter implements IInvoiceRepository {
  constructor(private readonly client: PoolClient) {}

  async createPending(input: CreatePendingInvoice): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, household_id, uploaded_by_user_id, image_s3_key, image_sha256, status)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING')
       RETURNING id`,
      [input.tenantId, input.householdId, input.uploadedByUserId, input.imageS3Key, input.imageSha256],
    );
    return result.rows[0].id;
  }

  async getById(invoiceId: string): Promise<InvoiceRecord | null> {
    const result = await this.client.query<InvoiceRow>(
      `SELECT id, tenant_id, status, image_s3_key, image_sha256, household_id
       FROM invoice WHERE id = $1`,
      [invoiceId],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async findSameTenantByHash(imageSha256: string): Promise<InvoiceRecord | null> {
    const result = await this.client.query<InvoiceRow>(
      `SELECT id, tenant_id, status, image_s3_key, image_sha256, household_id
       FROM invoice WHERE image_sha256 = $1 LIMIT 1`,
      [imageSha256],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async findFuzzyDuplicate(invoiceId: string, fp: FuzzyFingerprint): Promise<boolean> {
    const result = await this.client.query(
      `SELECT 1 FROM invoice i
       WHERE i.id <> $1
         AND i.merchant_id IS NOT DISTINCT FROM $2
         AND i.transaction_date = $3
         AND i.total = $4
         AND i.status IN ('PARSED', 'NEEDS_REVIEW')
         AND (SELECT count(*) FROM invoice_line l WHERE l.invoice_id = i.id) = $5
       LIMIT 1`,
      [invoiceId, fp.merchantId, fp.transactionDate, fp.total, fp.lineCount],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async persistParsed(input: PersistParsedInvoice): Promise<void> {
    await this.client.query(
      `UPDATE invoice
         SET merchant_id = $2, branch_id = $3, transaction_date = $4, currency = $5,
             total = $6, category_id = $7, search_tags = $8, status = $9
       WHERE id = $1`,
      [
        input.invoiceId, input.merchantId, input.branchId, input.transactionDate,
        input.currency, input.total, input.categoryId, input.searchTags, input.status,
      ],
    );

    for (const line of input.lines) {
      await this.client.query(
        `INSERT INTO invoice_line
           (invoice_id, raw_text, product_id, category_id, quantity, pack_quantity,
            base_unit, unit_price, normalized_unit_price, line_total, is_discount,
            is_deposit_or_fee, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          input.invoiceId, line.rawText, line.productId, line.categoryId, line.quantity,
          line.packQuantity, line.baseUnit, line.unitPrice, line.normalizedUnitPrice,
          line.lineTotal, line.isDiscount, line.isDepositOrFee, line.confidence,
        ],
      );
    }
  }

  async updateStatus(invoiceId: string, status: InvoiceStatus): Promise<void> {
    await this.client.query(`UPDATE invoice SET status = $2 WHERE id = $1`, [invoiceId, status]);
  }

  async listForTenant(limit: number): Promise<InvoiceListItem[]> {
    const result = await this.client.query<InvoiceListRow>(
      `SELECT ${LIST_COLUMNS}
       FROM invoice i LEFT JOIN merchant m ON m.id = i.merchant_id
       WHERE i.status <> 'DISCARDED'
       ORDER BY i.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(toListItem);
  }

  async getDetail(invoiceId: string): Promise<InvoiceDetail | null> {
    const head = await this.client.query<InvoiceListRow & { image_s3_key: string }>(
      `SELECT ${LIST_COLUMNS}, i.image_s3_key
       FROM invoice i LEFT JOIN merchant m ON m.id = i.merchant_id
       WHERE i.id = $1`,
      [invoiceId],
    );
    if (!head.rows[0]) return null;

    const lines = await this.client.query<{ raw_text: string; quantity: string; unit_price: string | null; line_total: string }>(
      `SELECT raw_text, quantity::text, unit_price::text, line_total::text
       FROM invoice_line WHERE invoice_id = $1 ORDER BY id`,
      [invoiceId],
    );

    const detailLines: InvoiceDetailLine[] = lines.rows.map(l => ({
      rawText: l.raw_text,
      quantity: parseFloat(l.quantity),
      unitPrice: num(l.unit_price),
      lineTotal: parseFloat(l.line_total),
    }));

    return { ...toListItem(head.rows[0]), imageS3Key: head.rows[0].image_s3_key, lines: detailLines };
  }
}

function toRecord(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    imageS3Key: row.image_s3_key,
    imageSha256: row.image_sha256,
    householdId: row.household_id,
  };
}
