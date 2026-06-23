// Raw cross-tenant counts for a single UTC day, read via the admin_business_kpis
// SECURITY DEFINER helper (Epic 15). Ratios/derived metrics are computed in the
// domain (businessKpis) — this port only returns the primitives.
export interface BusinessKpiSnapshot {
  registrations: number;
  dau: number;
  mau: number;
  premiumCount: number;
  activeUsers: number;
  feedbackUp: number;
  feedbackTotal: number;
}

export interface IBusinessKpiSource {
  getSnapshot(metricDate: string): Promise<BusinessKpiSnapshot>;
}
