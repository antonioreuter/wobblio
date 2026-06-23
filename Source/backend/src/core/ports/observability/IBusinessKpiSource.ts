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
  feedbackDown: number;
  invoicesProcessed: number;
  invoicesFailed: number;
  newProducts: number;
  waitlistUsers: number;
  deletedUsers: number;
  totalUsers: number;
  standardUsers: number;
  invoicesPending: number;
  usersLowScore: number;
}

export interface MerchantCountryCount {
  country: string;
  count: number;
}

export interface InvoiceRegionCount {
  country: string;
  region: string | null;
  count: number;
}

export interface IBusinessKpiSource {
  getSnapshot(metricDate: string): Promise<BusinessKpiSnapshot>;
  // New merchants created on the day, grouped by country.
  getNewMerchantsByCountry(metricDate: string): Promise<MerchantCountryCount[]>;
  // Invoices uploaded that day, grouped by confirmed country/region.
  getInvoicesByRegion(metricDate: string): Promise<InvoiceRegionCount[]>;
}
