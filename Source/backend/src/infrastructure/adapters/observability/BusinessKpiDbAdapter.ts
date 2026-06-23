import type { Pool, PoolClient } from 'pg';
import type {
  IBusinessKpiSource,
  BusinessKpiSnapshot,
} from '@core/ports/observability/IBusinessKpiSource';

interface KpiDbRow {
  registrations: string;
  dau: string;
  mau: string;
  premium_count: string;
  active_users: string;
  feedback_up: string;
  feedback_total: string;
}

// Reads the day's cross-tenant counts through the admin_business_kpis SECURITY
// DEFINER helper (bypasses RLS on app_user/invoice/invoice_feedback).
export class BusinessKpiDbAdapter implements IBusinessKpiSource {
  constructor(private readonly pool: Pool | PoolClient) {}

  async getSnapshot(metricDate: string): Promise<BusinessKpiSnapshot> {
    const result = await this.pool.query<KpiDbRow>('SELECT * FROM admin_business_kpis($1)', [metricDate]);
    const r = result.rows[0];
    return {
      registrations: Number(r?.registrations ?? 0),
      dau: Number(r?.dau ?? 0),
      mau: Number(r?.mau ?? 0),
      premiumCount: Number(r?.premium_count ?? 0),
      activeUsers: Number(r?.active_users ?? 0),
      feedbackUp: Number(r?.feedback_up ?? 0),
      feedbackTotal: Number(r?.feedback_total ?? 0),
    };
  }
}
