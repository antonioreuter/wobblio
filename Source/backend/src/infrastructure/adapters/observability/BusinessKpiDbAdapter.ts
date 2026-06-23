import type { Pool, PoolClient } from 'pg';
import type {
  IBusinessKpiSource,
  BusinessKpiSnapshot,
  MerchantCountryCount,
  InvoiceRegionCount,
} from '@core/ports/observability/IBusinessKpiSource';

interface KpiDbRow {
  registrations: string;
  dau: string;
  mau: string;
  premium_count: string;
  active_users: string;
  feedback_up: string;
  feedback_total: string;
  feedback_down: string;
  invoices_processed: string;
  invoices_failed: string;
  new_products: string;
  waitlist_users: string;
  deleted_users: string;
  total_users: string;
  standard_users: string;
  invoices_pending: string;
  users_low_score: string;
}

interface MerchantCountryRow {
  country_code: string;
  cnt: string;
}

interface InvoiceRegionRow {
  country_code: string;
  region_code: string | null;
  cnt: string;
}

// Reads the day's cross-tenant counts through the admin_business_kpis +
// admin_new_merchants_by_country SECURITY DEFINER helpers (bypass RLS on
// app_user/invoice/invoice_feedback/merchant/product).
export class BusinessKpiDbAdapter implements IBusinessKpiSource {
  constructor(private readonly pool: Pool | PoolClient) {}

  async getSnapshot(metricDate: string): Promise<BusinessKpiSnapshot> {
    const result = await this.pool.query<KpiDbRow>('SELECT * FROM admin_business_kpis($1)', [metricDate]);
    const r = result.rows[0];
    return {
      registrations: num(r?.registrations),
      dau: num(r?.dau),
      mau: num(r?.mau),
      premiumCount: num(r?.premium_count),
      activeUsers: num(r?.active_users),
      feedbackUp: num(r?.feedback_up),
      feedbackTotal: num(r?.feedback_total),
      feedbackDown: num(r?.feedback_down),
      invoicesProcessed: num(r?.invoices_processed),
      invoicesFailed: num(r?.invoices_failed),
      newProducts: num(r?.new_products),
      waitlistUsers: num(r?.waitlist_users),
      deletedUsers: num(r?.deleted_users),
      totalUsers: num(r?.total_users),
      standardUsers: num(r?.standard_users),
      invoicesPending: num(r?.invoices_pending),
      usersLowScore: num(r?.users_low_score),
    };
  }

  async getNewMerchantsByCountry(metricDate: string): Promise<MerchantCountryCount[]> {
    const result = await this.pool.query<MerchantCountryRow>(
      'SELECT country_code, cnt FROM admin_new_merchants_by_country($1)',
      [metricDate],
    );
    return result.rows.map((row) => ({ country: row.country_code, count: num(row.cnt) }));
  }

  async getInvoicesByRegion(metricDate: string): Promise<InvoiceRegionCount[]> {
    const result = await this.pool.query<InvoiceRegionRow>(
      'SELECT country_code, region_code, cnt FROM admin_invoices_by_region($1)',
      [metricDate],
    );
    return result.rows.map((row) => ({
      country: row.country_code,
      region: row.region_code,
      count: num(row.cnt),
    }));
  }
}

function num(value: string | undefined): number {
  return Number(value ?? 0);
}
