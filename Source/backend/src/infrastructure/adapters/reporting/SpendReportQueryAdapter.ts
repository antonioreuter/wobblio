import type { Pool, PoolClient } from 'pg';
import type {
  ISpendReportQuery,
  SpendReportFilter,
  CategoryAmountRow,
  MerchantAmountRow,
  ItemCategoryAmountRow,
  ItemAmountRow,
} from '@core/ports/reporting/ISpendReportQuery';
import { UNCATEGORIZED_ID, UNKNOWN_MERCHANT_ID, type SpendOccurrence } from '@core/domain/spendReport';

// Line-rooted spend aggregation over the caller's RLS-scoped invoices — the db MUST already
// carry the tenant context (see withTenantTx). Every amount is `line_total` converted to the
// caller's home currency via the invoice's frozen fx_rate_used, and signed (discount lines net
// negative). Spend-counting semantics (status allowlist, date coalesce) mirror compute_budget_spend
// so this report counts the same receipts as budgets. Region filter mirrors
// OwnPurchaseHistoryQueryAdapter. `homeCurrency` labels the report and gates unconvertible rows.
export class SpendReportQueryAdapter implements ISpendReportQuery {
  constructor(
    private readonly db: Pool | PoolClient,
    private readonly homeCurrency: string | null,
  ) {}

  async categories(filter: SpendReportFilter): Promise<CategoryAmountRow[]> {
    const params: unknown[] = [];
    const where = windowAndRegion(filter, this.homeCurrency, params);
    const result = await this.db.query<{ macro_id: string | null; amount: string; line_count: string }>(
      `SELECT COALESCE(pc.parent_id, l.category_id) AS macro_id,
              SUM(${HOME_AMOUNT})::text AS amount,
              COUNT(*)::text AS line_count
       FROM invoice_line l
       JOIN invoice i ON i.id = l.invoice_id
       LEFT JOIN product_category pc ON pc.id = l.category_id
       WHERE ${where}
       GROUP BY COALESCE(pc.parent_id, l.category_id)
       ORDER BY SUM(${HOME_AMOUNT}) DESC`,
      params,
    );
    return result.rows.map((r) => ({
      macroId: r.macro_id,
      amount: parseFloat(r.amount),
      lineCount: parseInt(r.line_count, 10),
    }));
  }

  async merchants(macroId: string, filter: SpendReportFilter): Promise<MerchantAmountRow[]> {
    const params: unknown[] = [];
    const where = windowAndRegion(filter, this.homeCurrency, params);
    const macro = macroClause(macroId, params);
    const result = await this.db.query<{
      merchant_id: string | null;
      merchant_name: string | null;
      amount: string;
      line_count: string;
      invoice_count: string;
      last_purchased_on: string | null;
    }>(
      `SELECT i.merchant_id AS merchant_id,
              m.brand_name AS merchant_name,
              SUM(${HOME_AMOUNT})::text AS amount,
              COUNT(*)::text AS line_count,
              COUNT(DISTINCT i.id)::text AS invoice_count,
              MAX(COALESCE(i.transaction_date, i.created_at::date))::text AS last_purchased_on
       FROM invoice_line l
       JOIN invoice i ON i.id = l.invoice_id
       LEFT JOIN product_category pc ON pc.id = l.category_id
       LEFT JOIN merchant m ON m.id = i.merchant_id
       WHERE ${where} ${macro}
       GROUP BY i.merchant_id, m.brand_name
       ORDER BY SUM(${HOME_AMOUNT}) DESC`,
      params,
    );
    return result.rows.map((r) => ({
      merchantId: r.merchant_id,
      merchantName: r.merchant_name,
      amount: parseFloat(r.amount),
      lineCount: parseInt(r.line_count, 10),
      invoiceCount: parseInt(r.invoice_count, 10),
      lastPurchasedOn: r.last_purchased_on,
    }));
  }

  async itemCategories(
    macroId: string,
    merchantId: string,
    filter: SpendReportFilter,
  ): Promise<ItemCategoryAmountRow[]> {
    const params: unknown[] = [];
    const where = windowAndRegion(filter, this.homeCurrency, params);
    const macro = macroClause(macroId, params);
    const merchant = merchantClause(merchantId, params);
    const result = await this.db.query<{ category_id: string | null; amount: string; line_count: string }>(
      `SELECT l.category_id AS category_id,
              SUM(${HOME_AMOUNT})::text AS amount,
              COUNT(*)::text AS line_count
       FROM invoice_line l
       JOIN invoice i ON i.id = l.invoice_id
       LEFT JOIN product_category pc ON pc.id = l.category_id
       WHERE ${where} ${macro} ${merchant}
       GROUP BY l.category_id
       ORDER BY SUM(${HOME_AMOUNT}) DESC`,
      params,
    );
    return result.rows.map((r) => ({
      categoryId: r.category_id,
      amount: parseFloat(r.amount),
      lineCount: parseInt(r.line_count, 10),
    }));
  }

  async items(
    merchantId: string,
    itemCategoryId: string,
    filter: SpendReportFilter,
  ): Promise<ItemAmountRow[]> {
    const params: unknown[] = [];
    const where = windowAndRegion(filter, this.homeCurrency, params);
    const merchant = merchantClause(merchantId, params);
    const leaf = leafClause(itemCategoryId, params);
    const result = await this.db.query<{
      group_key: string;
      name: string;
      quantity: string;
      amount: string;
      line_count: string;
      occurrences: RawOccurrence[];
    }>(
      `SELECT COALESCE(l.product_id::text, 'raw:' || lower(btrim(l.raw_text))) AS group_key,
              MAX(COALESCE(p.display_name, l.raw_text)) AS name,
              SUM(l.quantity)::text AS quantity,
              SUM(${HOME_AMOUNT})::text AS amount,
              COUNT(*)::text AS line_count,
              json_agg(json_build_object(
                'date', to_char(COALESCE(i.transaction_date, i.created_at::date), 'YYYY-MM-DD'),
                'invoiceId', i.id,
                'quantity', l.quantity,
                'amount', ${HOME_AMOUNT}
              ) ORDER BY COALESCE(i.transaction_date, i.created_at::date) DESC) AS occurrences
       FROM invoice_line l
       JOIN invoice i ON i.id = l.invoice_id
       LEFT JOIN product p ON p.id = l.product_id
       WHERE ${where} ${merchant} ${leaf}
       GROUP BY group_key
       ORDER BY SUM(${HOME_AMOUNT}) DESC`,
      params,
    );
    return result.rows.map((r) => ({
      groupKey: r.group_key,
      name: r.name,
      quantity: parseFloat(r.quantity),
      amount: parseFloat(r.amount),
      lineCount: parseInt(r.line_count, 10),
      occurrences: (r.occurrences ?? []).map(toOccurrence),
    }));
  }
}

interface RawOccurrence {
  date: string;
  invoiceId: string;
  quantity: number | string;
  amount: number | string;
}

function toOccurrence(raw: RawOccurrence): SpendOccurrence {
  return {
    date: raw.date,
    invoiceId: raw.invoiceId,
    quantity: Number(raw.quantity),
    amount: Number(raw.amount),
  };
}

// line_total (invoice currency) → home currency via the frozen per-invoice rate. Unconvertible
// rows are already excluded by windowAndRegion's currency gate, so a NULL fx_rate_used here can
// only be a same-currency (face-value) invoice → COALESCE(...,1) is correct.
const HOME_AMOUNT = 'l.line_total * COALESCE(i.fx_rate_used, 1)';

// Shared status/date/currency/region predicate; pushes bind params and returns the SQL.
// The currency gate keeps a row only when it can be honestly valued in the home currency:
// fx_rate_used is set (converted at ingestion) OR the invoice is already in the home currency
// (legacy pre-FX same-currency rows). A foreign invoice whose ECB rate was missing (fx_rate_used
// NULL, currency ≠ home) is dropped — never summed at face value, matching budgets/exports.
// Region empty ⇒ no location filter ("all regions"); a set region includes pending-location
// receipts whose country matches (or is unknown).
function windowAndRegion(filter: SpendReportFilter, homeCurrency: string | null, params: unknown[]): string {
  params.push(filter.from);
  const from = `$${params.length}`;
  params.push(filter.to);
  const to = `$${params.length}`;
  params.push(homeCurrency);
  const home = `$${params.length}`;
  let clause = `i.status IN ('PARSED', 'NEEDS_REVIEW')
    AND COALESCE(i.transaction_date, i.created_at::date) >= ${from}::date
    AND COALESCE(i.transaction_date, i.created_at::date) <  ${to}::date
    AND (i.fx_rate_used IS NOT NULL OR i.currency = ${home})`;

  if (filter.region.trim()) {
    params.push(filter.country);
    const c = `$${params.length}`;
    params.push(filter.region);
    const r = `$${params.length}`;
    clause += `
    AND (
      (i.location_status = 'RESOLVED' AND i.location_country_code = ${c} AND i.location_region_code = ${r})
      OR (i.location_status <> 'RESOLVED' AND (i.location_country_code = ${c} OR i.location_country_code IS NULL))
    )`;
  }
  return clause;
}

// Restrict to one macro category. The UNCATEGORIZED sentinel matches lines with no category;
// otherwise roll the line's (possibly sub-) category up to its macro and match.
function macroClause(macroId: string, params: unknown[]): string {
  if (macroId === UNCATEGORIZED_ID) return 'AND l.category_id IS NULL';
  params.push(macroId);
  return `AND COALESCE(pc.parent_id, l.category_id) = $${params.length}`;
}

function merchantClause(merchantId: string, params: unknown[]): string {
  if (merchantId === UNKNOWN_MERCHANT_ID) return 'AND i.merchant_id IS NULL';
  params.push(merchantId);
  return `AND i.merchant_id = $${params.length}::uuid`;
}

function leafClause(itemCategoryId: string, params: unknown[]): string {
  if (itemCategoryId === UNCATEGORIZED_ID) return 'AND l.category_id IS NULL';
  params.push(itemCategoryId);
  return `AND l.category_id = $${params.length}`;
}
