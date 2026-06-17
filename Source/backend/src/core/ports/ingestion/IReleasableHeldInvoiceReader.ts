// Cross-tenant discovery for the HELD_UNMAPPED release cron. Backed by the
// SECURITY DEFINER function list_releasable_held_invoices, which bypasses RLS to
// find held invoices whose stored location is now mapped to reference data.
export interface ReleasableHeldInvoice {
  invoiceId: string;
  tenantId: string;
  countryCode: string;
  regionCode: string;
}

export interface IReleasableHeldInvoiceReader {
  listReleasable(limit: number): Promise<ReleasableHeldInvoice[]>;
}
