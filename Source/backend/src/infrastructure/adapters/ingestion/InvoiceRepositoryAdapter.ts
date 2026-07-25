import type { PoolClient } from 'pg';
import type {
  IInvoiceRepository,
  CreatePendingInvoice,
  InvoiceRecord,
  InvoiceChargeTarget,
  FuzzyFingerprint,
  PersistParsedInvoice,
  ConfirmLocationInput,
  InvoiceReEmission,
  InvoiceListItem,
  InvoiceDetail,
  InvoiceDetailLine,
  CorrectInvoiceInput,
  TopMerchant,
} from '@core/ports/ingestion/IInvoiceRepository';
import type { InvoiceStatus, InvoiceVerdict } from '@core/domain/ingestion';
import type { FailureReasonCode, UnreadableReason } from '@core/domain/failureReasons';
import type { InvoiceLocationStatus } from '@core/domain/region';
import { categoryNameFor } from '@core/domain/categoryTaxonomy';
import { InvalidCorrectionError } from '@core/domain/errors';
import { tagLabelFor } from '@core/domain/tagVocabulary';

interface InvoiceListRow {
  id: string;
  status: InvoiceStatus;
  merchant_name: string | null;
  category_id: string | null;
  transaction_date: string | null;
  total: string | null;
  currency: string | null;
  total_home_currency: string | null;
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
  totalHomeCurrency: num(row.total_home_currency),
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
  i.currency, i.total_home_currency::text AS total_home_currency,
  i.search_tags, i.search_city, i.created_at::text AS created_at,
  i.location_status, i.location_country_code, i.location_region_code`;

interface InvoiceRow {
  id: string;
  tenant_id: string;
  status: InvoiceStatus;
  image_s3_key: string;
  image_sha256: string;
  household_id: string | null;
  system_fault_reason: string | null;
  location_status: InvoiceLocationStatus;
  location_confirmed_at: string | null;
  upload_country_code: string | null;
  upload_region_code: string | null;
}

const RECORD_COLUMNS = `id, tenant_id, status, image_s3_key, image_sha256, household_id,
  system_fault_reason, location_status, location_confirmed_at::text AS location_confirmed_at,
  upload_country_code, upload_region_code`;

// All methods rely on RLS (app.current_tenant_id) set on this client's transaction.
export class InvoiceRepositoryAdapter implements IInvoiceRepository {
  constructor(private readonly client: PoolClient) {}

  async createPending(input: CreatePendingInvoice): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, household_id, uploaded_by_user_id, image_s3_key, image_sha256, status,
          upload_country_code, upload_region_code, quota_pooled)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING', $6, $7, $8)
       RETURNING id`,
      [
        input.tenantId, input.householdId, input.uploadedByUserId, input.imageS3Key,
        input.imageSha256, input.uploadCountryCode, input.uploadRegionCode, input.quotaPooled,
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

  async findChargeTarget(invoiceId: string): Promise<InvoiceChargeTarget | null> {
    const result = await this.client.query<{ quota_pooled: boolean; household_id: string | null; created_at: string }>(
      `SELECT quota_pooled, household_id, created_at::text AS created_at FROM invoice WHERE id = $1`,
      [invoiceId],
    );
    const row = result.rows[0];
    return row
      ? { quotaPooled: row.quota_pooled, householdId: row.household_id, createdAt: row.created_at }
      : null;
  }

  // Pool counter is keyed by household_id; the personal counter by the uploader. Both
  // run inside the presign tenant transaction, so RLS scopes the count to the caller.
  async countInFlightUploads(ownerId: string, isPool: boolean, weekStart: string): Promise<number> {
    const ownerColumn = isPool ? 'household_id' : 'uploaded_by_user_id';
    const result = await this.client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM invoice
       WHERE ${ownerColumn} = $1 AND status = 'PROCESSING' AND created_at >= $2::date`,
      [ownerId, weekStart],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
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
      // Clear any prior failure/quarantine state: this is the success write, so a
      // reprocessed invoice (§03.7 reprocess-on-behalf) must not stay blocked from deletion.
      `UPDATE invoice
         SET merchant_id = $2, merchant_provisional = $3,
             transaction_date = $4, currency = $5, total = $6, category_id = $7,
             search_tags = $8, status = $9, location_country_code = $10,
             location_region_code = $11, location_status = $12, location_source = $13,
             price_emission_blocked = $14, search_city = $15,
             total_home_currency = $16, fx_rate_used = $17,
             failure_reason_code = NULL, system_fault_reason = NULL, blocked_at = NULL
       WHERE id = $1`,
      [
        input.invoiceId, input.merchantId, input.merchantProvisional,
        input.transactionDate, input.currency, input.total, input.categoryId,
        input.searchTags, input.status, input.location.countryCode,
        input.location.regionCode, input.location.status, input.location.source,
        input.priceEmissionBlocked, input.searchCity,
        input.totalHomeCurrency, input.fxRateUsed,
      ],
    );

    for (const line of input.lines) {
      await this.client.query(
        `INSERT INTO invoice_line
           (invoice_id, line_index, raw_text, product_id, product_provisional, category_id,
            quantity, pack_quantity, base_unit, size_source, unit_price, line_total,
            is_discount, is_deposit_or_fee, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          input.invoiceId, line.lineIndex, line.rawText, line.productId, line.productProvisional,
          line.categoryId, line.quantity, line.packQuantity, line.baseUnit, line.sizeSource,
          line.unitPrice, line.lineTotal, line.isDiscount, line.isDepositOrFee,
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
      user_corrected: boolean;
    }>(
      `SELECT merchant_id, merchant_provisional, transaction_date::text AS transaction_date,
              currency, (corrected_at IS NOT NULL) AS user_corrected
       FROM invoice
       WHERE id = $1 AND status IN ('PARSED', 'NEEDS_REVIEW') AND NOT price_emission_blocked`,
      [invoiceId],
    );
    const row = head.rows[0];
    if (!row || row.transaction_date === null || row.currency === null) return null;

    const lines = await this.client.query<{
      product_id: string | null;
      product_provisional: boolean;
      is_deposit_or_fee: boolean;
      quantity: string;
      line_total: string;
      unit_price: string | null;
    }>(
      `SELECT product_id, product_provisional, is_deposit_or_fee,
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
      userCorrected: row.user_corrected,
      lines: lines.rows.map(l => ({
        productId: l.product_id,
        productProvisional: l.product_provisional,
        isDepositOrFee: l.is_deposit_or_fee,
        quantity: parseFloat(l.quantity),
        lineTotal: parseFloat(l.line_total),
        listUnitPrice: num(l.unit_price),
      })),
    };
  }

  // §03.2 — user-fault failure: the model ran but judged the image unreadable. Sets the
  // user-fault reason and clears any prior quarantine (a reprocess that comes back
  // unreadable must end deletable), so system_fault_reason is null → the invoice is deletable.
  async markUnreadable(invoiceId: string, reason: UnreadableReason): Promise<void> {
    await this.client.query(
      `UPDATE invoice
         SET status = 'FAILED_PROCESSING', failure_reason_code = $2,
             system_fault_reason = NULL, blocked_at = NULL
       WHERE id = $1`,
      [invoiceId, reason],
    );
  }

  // §03.6 — quarantine after an our-stack crash. Charges nothing (the run rolled back).
  // The status guard makes redelivery a no-op (0 rows) so blocked_at/root cause aren't
  // overwritten; the rowCount tells the caller whether this was the transition into
  // quarantine, so the owner is notified exactly once.
  async markFailed(invoiceId: string, reasonCode: FailureReasonCode): Promise<void> {
    await this.client.query(
      `UPDATE invoice
         SET status = 'FAILED_PROCESSING', failure_reason_code = $2,
             system_fault_reason = NULL, blocked_at = NULL
       WHERE id = $1`,
      [invoiceId, reasonCode],
    );
  }

  // Fix 11 Layer C — a photo parse still objectively broken after escalation. Deletable (no
  // system_fault_reason), and the worker skips the charge for this run.
  async markRetake(invoiceId: string): Promise<void> {
    await this.client.query(
      `UPDATE invoice
         SET status = 'RETAKE_SUGGESTED', failure_reason_code = 'RETAKE_LOW_QUALITY',
             system_fault_reason = NULL, blocked_at = NULL
       WHERE id = $1`,
      [invoiceId],
    );
  }

  async quarantine(invoiceId: string, systemFaultReason: string): Promise<boolean> {
    const result = await this.client.query(
      `UPDATE invoice
         SET status = 'FAILED_PROCESSING', failure_reason_code = 'SYSTEM_FAULT',
             system_fault_reason = $2, blocked_at = now()
       WHERE id = $1 AND status <> 'FAILED_PROCESSING'`,
      [invoiceId, systemFaultReason],
    );
    return result.rowCount !== null && result.rowCount > 0;
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

  // Apply review-screen corrections (16e). RLS scopes both writes to the tenant, so a
  // cross-tenant id touches no rows. corrected_at stamps the invoice user-trusted, and
  // an edited line resets confidence to 1 (the user vouched for it → no longer amber).
  // Only the lines the user actually changed are sent, so untouched lines keep their state.
  async applyCorrection(input: CorrectInvoiceInput): Promise<void> {
    await this.client.query(
      `UPDATE invoice
         SET transaction_date = $2, total = $3, status = 'PARSED', corrected_at = now()
       WHERE id = $1`,
      [input.invoiceId, input.transactionDate, input.total],
    );
    try {
      for (const line of input.lines) {
        // "Set size" (09/05): when the user annotated a pack size, stamp it USER-sourced; otherwise
        // COALESCE leaves any existing receipt size untouched. Size is identity metadata — no price.
        await this.client.query(
          `UPDATE invoice_line
             SET product_id = $3, quantity = $4, unit_price = $5, line_total = $6, confidence = 1,
                 pack_quantity = COALESCE($7, pack_quantity),
                 base_unit = COALESCE($8, base_unit),
                 size_source = CASE WHEN $7 IS NOT NULL THEN 'USER'::size_source ELSE size_source END
           WHERE id = $1 AND invoice_id = $2`,
          [line.id, input.invoiceId, line.productId, line.quantity, line.unitPrice, line.lineTotal,
           line.size?.packQuantity ?? null, line.size?.baseUnit ?? null],
        );
      }
    } catch (err) {
      // A line pointed at a non-existent product (deleted/merged since search) → FK
      // violation; surface it as a client error rather than an opaque 500.
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23503') {
        throw new InvalidCorrectionError('a line references a product that no longer exists');
      }
      throw err;
    }
  }

  async softDelete(invoiceId: string): Promise<void> {
    await this.client.query(`UPDATE invoice SET status = 'DISCARDED' WHERE id = $1`, [invoiceId]);
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

  async getTopMerchantsThisMonth(limit: number): Promise<TopMerchant[]> {
    const result = await this.client.query<{ merchant_name: string; total: string }>(
      `SELECT m.brand_name AS merchant_name, SUM(i.total * COALESCE(i.fx_rate_used, 1))::text AS total
       FROM invoice i
       JOIN merchant m ON m.id = i.merchant_id
       JOIN app_user u ON u.id = (current_setting('app.current_tenant_id', true))::uuid
       WHERE i.status <> 'DISCARDED'
         AND i.total IS NOT NULL
         AND (i.fx_rate_used IS NOT NULL OR i.currency = u.home_currency OR i.currency IS NULL)
         AND i.transaction_date >= date_trunc('month', CURRENT_DATE)
         AND i.transaction_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
       GROUP BY m.brand_name
       ORDER BY SUM(i.total * COALESCE(i.fx_rate_used, 1)) DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => ({ name: row.merchant_name, total: parseFloat(row.total) }));
  }

  async getDetail(invoiceId: string): Promise<InvoiceDetail | null> {
    const head = await this.client.query<InvoiceListRow & { image_s3_key: string; feedback_verdict: InvoiceVerdict | null; failure_reason_code: FailureReasonCode | null; fx_rate_used: string | null; home_currency: string | null }>(
      `SELECT ${LIST_COLUMNS}, i.image_s3_key, i.failure_reason_code, f.verdict AS feedback_verdict,
              i.fx_rate_used::text AS fx_rate_used,
              u.home_currency
       FROM invoice i
       LEFT JOIN merchant m ON m.id = i.merchant_id
       LEFT JOIN invoice_feedback f ON f.invoice_id = i.id
       LEFT JOIN app_user u ON u.id = (current_setting('app.current_tenant_id', true))::uuid
       WHERE i.id = $1`,
      [invoiceId],
    );
    if (!head.rows[0]) return null;

    const lines = await this.client.query<{ id: string; raw_text: string; product_id: string | null; quantity: string; unit_price: string | null; line_total: string; category_name: string | null; confidence: string; is_discount: boolean; is_deposit_or_fee: boolean; pack_quantity: string | null; base_unit: 'KG' | 'L' | 'PIECE' | null; size_source: 'RECEIPT' | 'USER' | null }>(
      `SELECT il.id, il.raw_text, il.product_id, il.quantity::text, il.unit_price::text,
              il.line_total::text, pc.name AS category_name, il.confidence::text AS confidence,
              il.is_discount, il.is_deposit_or_fee,
              il.pack_quantity::text AS pack_quantity, il.base_unit, il.size_source
       FROM invoice_line il LEFT JOIN product_category pc ON pc.id = il.category_id
       WHERE il.invoice_id = $1 ORDER BY il.line_index`,
      [invoiceId],
    );

    const detailLines: InvoiceDetailLine[] = lines.rows.map(l => ({
      id: l.id,
      rawText: l.raw_text,
      productId: l.product_id,
      quantity: parseFloat(l.quantity),
      unitPrice: num(l.unit_price),
      lineTotal: parseFloat(l.line_total),
      categoryName: l.category_name,
      confidence: parseFloat(l.confidence),
      isDiscount: l.is_discount,
      isDepositOrFee: l.is_deposit_or_fee,
      packQuantity: num(l.pack_quantity),
      baseUnit: l.base_unit,
      sizeSource: l.size_source,
    }));

    return {
      ...toListItem(head.rows[0]),
      imageS3Key: head.rows[0].image_s3_key,
      fxRateUsed: num(head.rows[0].fx_rate_used),
      homeCurrency: head.rows[0].home_currency,
      feedbackVerdict: head.rows[0].feedback_verdict,
      failureReasonCode: head.rows[0].failure_reason_code,
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
    systemFaultReason: row.system_fault_reason,
    locationStatus: row.location_status,
    locationConfirmedAt: row.location_confirmed_at,
    uploadCountryCode: row.upload_country_code,
    uploadRegionCode: row.upload_region_code,
  };
}
