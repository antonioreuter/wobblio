import type { PoolClient } from 'pg';
import type {
  IInvoiceRepository,
  CreatePendingInvoice,
  InvoiceRecord,
  FuzzyFingerprint,
  PersistParsedInvoice,
  ConfirmLocationInput,
  InvoiceReEmission,
  InvoiceListItem,
  InvoiceDetail,
  InvoiceDetailLine,
  TopMerchant,
} from '@core/ports/ingestion/IInvoiceRepository';
import type { InvoiceStatus, InvoiceVerdict } from '@core/domain/ingestion';
import type { InvoiceLocationStatus } from '@core/domain/region';
import type { ObservationLine } from '@core/domain/priceObservation';
import { categoryNameFor } from '@core/domain/categoryTaxonomy';
import { tagLabelFor } from '@core/domain/tagVocabulary';

interface InvoiceListRow {
  id: string;
  status: InvoiceStatus;
  merchant_name: string | null;
  category_id: string | null;
  transaction_date: string | null;
  total: string | null;
  currency: string | null;
  search_tags: string[];
  search_city: string | null;
  created_at: string;
  location_status: InvoiceLocationStatus;
  location_country_code: string | null;
  location_region_code: string | null;
}

const num = (v: string | null): number | null => (v === null ? null : parseFloat(v));

const toListItem = (row: InvoiceListRow): InvoiceListItem => ({
  id: row.id,
  status: row.status,
  merchantName: row.merchant_name,
  categoryId: row.category_id,
  categoryName: categoryNameFor(row.category_id),
  transactionDate: row.transaction_date,
  total: num(row.total),
  currency: row.currency,
  searchTags: row.search_tags,
  searchTagLabels: row.search_tags.map(tagLabelFor),
  searchCity: row.search_city,
  createdAt: row.created_at,
  locationStatus: row.location_status,
  locationCountryCode: row.location_country_code,
  locationRegionCode: row.location_region_code,
});

const LIST_COLUMNS = `
  i.id, i.status, m.brand_name AS merchant_name, i.category_id,
  i.transaction_date::text AS transaction_date, i.total::text AS total,
  i.currency, i.search_tags, i.search_city, i.created_at::text AS created_at,
  i.location_status, i.location_country_code, i.location_region_code`;

interface InvoiceRow {
  id: string;
  tenant_id: string;
  status: InvoiceStatus;
  image_s3_key: string;
  image_sha256: string;
  household_id: string | null;
  location_status: InvoiceLocationStatus;
  location_confirmed_at: string | null;
  upload_country_code: string | null;
  upload_region_code: string | null;
}

const RECORD_COLUMNS = `id, tenant_id, status, image_s3_key, image_sha256, household_id,
  location_status, location_confirmed_at::text AS location_confirmed_at,
  upload_country_code, upload_region_code`;

// All methods rely on RLS (app.current_tenant_id) set on this client's transaction.
export class InvoiceRepositoryAdapter implements IInvoiceRepository {
  constructor(private readonly client: PoolClient) {}

  async createPending(input: CreatePendingInvoice): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, household_id, uploaded_by_user_id, image_s3_key, image_sha256, status,
          upload_country_code, upload_region_code)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING', $6, $7)
       RETURNING id`,
      [
        input.tenantId, input.householdId, input.uploadedByUserId, input.imageS3Key,
        input.imageSha256, input.uploadCountryCode, input.uploadRegionCode,
      ],
    );
    return result.rows[0].id;
  }

  async getById(invoiceId: string): Promise<InvoiceRecord | null> {
    const result = await this.client.query<InvoiceRow>(
      `SELECT ${RECORD_COLUMNS} FROM invoice WHERE id = $1`,
      [invoiceId],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async findSameTenantByHash(imageSha256: string): Promise<InvoiceRecord | null> {
    const result = await this.client.query<InvoiceRow>(
      `SELECT ${RECORD_COLUMNS}
       FROM invoice WHERE image_sha256 = $1 AND status <> 'DISCARDED' LIMIT 1`,
      [imageSha256],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  // Another invoice (this tenant, via RLS) sharing this one's image hash that already
  // RESOLVED its location has emitted its observations; the re-upload must not emit again.
  async hasEmittedDuplicateByHash(invoiceId: string): Promise<boolean> {
    const result = await this.client.query(
      `SELECT 1 FROM invoice
       WHERE id <> $1
         AND image_sha256 = (SELECT image_sha256 FROM invoice WHERE id = $1)
         AND location_status = 'RESOLVED'
       LIMIT 1`,
      [invoiceId],
    );
    return result.rowCount !== null && result.rowCount > 0;
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
         SET merchant_id = $2, merchant_provisional = $3, branch_id = $4,
             transaction_date = $5, currency = $6, total = $7, category_id = $8,
             search_tags = $9, status = $10, location_country_code = $11,
             location_region_code = $12, location_status = $13, location_source = $14,
             price_emission_blocked = $15, search_city = $16
       WHERE id = $1`,
      [
        input.invoiceId, input.merchantId, input.merchantProvisional, input.branchId,
        input.transactionDate, input.currency, input.total, input.categoryId,
        input.searchTags, input.status, input.location.countryCode,
        input.location.regionCode, input.location.status, input.location.source,
        input.priceEmissionBlocked, input.searchCity,
      ],
    );

    for (const line of input.lines) {
      await this.client.query(
        `INSERT INTO invoice_line
           (invoice_id, line_index, raw_text, product_id, product_provisional, category_id,
            quantity, pack_quantity, base_unit, unit_price, normalized_unit_price, line_total,
            is_discount, is_deposit_or_fee, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          input.invoiceId, line.lineIndex, line.rawText, line.productId, line.productProvisional,
          line.categoryId, line.quantity, line.packQuantity, line.baseUnit, line.unitPrice,
          line.normalizedUnitPrice, line.lineTotal, line.isDiscount, line.isDepositOrFee,
          line.confidence,
        ],
      );
    }
  }

  // Write-once: the guard rejects a second confirmation so a location can't be
  // changed once set (the user gets one chance, per the data-quality gate).
  async confirmLocation(input: ConfirmLocationInput): Promise<void> {
    await this.client.query(
      `UPDATE invoice
         SET location_country_code = $2, location_region_code = $3,
             location_status = $4, location_source = $5, location_confirmed_at = now()
       WHERE id = $1 AND location_confirmed_at IS NULL`,
      [input.invoiceId, input.countryCode, input.regionCode, input.status, input.source],
    );
  }

  // Only an emit-eligible invoice (PARSED/NEEDS_REVIEW) yields re-emission rows; a
  // SUSPECTED_DUPLICATE or DISCARDED invoice returns null so deferred confirmation and
  // the release cron never emit observations for it (§6.8, invariant #7).
  async getForReEmission(invoiceId: string): Promise<InvoiceReEmission | null> {
    const head = await this.client.query<{
      merchant_id: string | null;
      merchant_provisional: boolean;
      transaction_date: string | null;
      currency: string | null;
    }>(
      `SELECT merchant_id, merchant_provisional, transaction_date::text AS transaction_date, currency
       FROM invoice
       WHERE id = $1 AND status IN ('PARSED', 'NEEDS_REVIEW') AND NOT price_emission_blocked`,
      [invoiceId],
    );
    const row = head.rows[0];
    if (!row || row.transaction_date === null || row.currency === null) return null;

    const lines = await this.client.query<{
      product_id: string | null;
      product_provisional: boolean;
      base_unit: ObservationLine['baseUnit'];
      normalized_unit_price: string | null;
      is_deposit_or_fee: boolean;
      quantity: string;
      line_total: string;
      unit_price: string | null;
    }>(
      `SELECT product_id, product_provisional, base_unit,
              normalized_unit_price::text AS normalized_unit_price, is_deposit_or_fee,
              quantity::text AS quantity, line_total::text AS line_total,
              unit_price::text AS unit_price
       FROM invoice_line WHERE invoice_id = $1 ORDER BY line_index`,
      [invoiceId],
    );

    return {
      merchantId: row.merchant_id,
      merchantProvisional: row.merchant_provisional,
      transactionDate: row.transaction_date,
      currency: row.currency,
      lines: lines.rows.map(l => ({
        productId: l.product_id,
        productProvisional: l.product_provisional,
        baseUnit: l.base_unit,
        normalizedUnitPrice: num(l.normalized_unit_price),
        isDepositOrFee: l.is_deposit_or_fee,
        quantity: parseFloat(l.quantity),
        lineTotal: parseFloat(l.line_total),
        listUnitPrice: num(l.unit_price),
      })),
    };
  }

  async markLocationResolved(invoiceId: string): Promise<void> {
    await this.client.query(
      `UPDATE invoice SET location_status = 'RESOLVED'
       WHERE id = $1 AND location_status = 'HELD_UNMAPPED'`,
      [invoiceId],
    );
  }

  async updateStatus(invoiceId: string, status: InvoiceStatus): Promise<void> {
    await this.client.query(`UPDATE invoice SET status = $2 WHERE id = $1`, [invoiceId, status]);
  }

  async softDelete(invoiceId: string): Promise<void> {
    await this.client.query(`UPDATE invoice SET status = 'DISCARDED' WHERE id = $1`, [invoiceId]);
  }

  async listForTenant(limit: number): Promise<InvoiceListItem[]> {
    const result = await this.client.query<InvoiceListRow>(
      `SELECT ${LIST_COLUMNS}
       FROM invoice i LEFT JOIN merchant m ON m.id = i.merchant_id
       WHERE i.status <> 'DISCARDED'
       ORDER BY i.transaction_date DESC NULLS LAST, i.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(toListItem);
  }

  async getTopMerchantThisMonth(): Promise<TopMerchant | null> {
    const result = await this.client.query<{ merchant_name: string; total: string }>(
      `SELECT m.brand_name AS merchant_name, SUM(i.total)::text AS total
       FROM invoice i JOIN merchant m ON m.id = i.merchant_id
       WHERE i.status <> 'DISCARDED'
         AND i.total IS NOT NULL
         AND i.transaction_date >= date_trunc('month', CURRENT_DATE)
         AND i.transaction_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
       GROUP BY m.brand_name
       ORDER BY SUM(i.total) DESC
       LIMIT 1`,
    );
    const row = result.rows[0];
    return row ? { name: row.merchant_name, total: parseFloat(row.total) } : null;
  }

  async getDetail(invoiceId: string): Promise<InvoiceDetail | null> {
    const head = await this.client.query<InvoiceListRow & { image_s3_key: string; feedback_verdict: InvoiceVerdict | null }>(
      `SELECT ${LIST_COLUMNS}, i.image_s3_key, f.verdict AS feedback_verdict
       FROM invoice i
       LEFT JOIN merchant m ON m.id = i.merchant_id
       LEFT JOIN invoice_feedback f ON f.invoice_id = i.id
       WHERE i.id = $1`,
      [invoiceId],
    );
    if (!head.rows[0]) return null;

    const lines = await this.client.query<{ raw_text: string; quantity: string; unit_price: string | null; line_total: string; category_name: string | null }>(
      `SELECT il.raw_text, il.quantity::text, il.unit_price::text, il.line_total::text, pc.name AS category_name
       FROM invoice_line il LEFT JOIN product_category pc ON pc.id = il.category_id
       WHERE il.invoice_id = $1 ORDER BY il.line_index`,
      [invoiceId],
    );

    const detailLines: InvoiceDetailLine[] = lines.rows.map(l => ({
      rawText: l.raw_text,
      quantity: parseFloat(l.quantity),
      unitPrice: num(l.unit_price),
      lineTotal: parseFloat(l.line_total),
      categoryName: l.category_name,
    }));

    return {
      ...toListItem(head.rows[0]),
      imageS3Key: head.rows[0].image_s3_key,
      feedbackVerdict: head.rows[0].feedback_verdict,
      lines: detailLines,
    };
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
    locationStatus: row.location_status,
    locationConfirmedAt: row.location_confirmed_at,
    uploadCountryCode: row.upload_country_code,
    uploadRegionCode: row.upload_region_code,
  };
}
