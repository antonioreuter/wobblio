export interface ExportAccount {
  fullName: string;
  email: string;
  country: string;
  language: string;
  currency: string;
  createdAt: string;
  priceContributionOptout: boolean;
}

export interface ReceiptImageRef {
  invoiceId: string;
  imageS3Key: string;
}

// Deliberately lean and read-only: explicit column lists only, never a reuse of the feature
// repositories (InvoiceRepositoryAdapter, etc.), which carry internal fields (system_fault_reason,
// alert_85_fired, ...) that must never leak into a GDPR export.
export interface IExportDataSource {
  getAccount(tenantId: string): Promise<ExportAccount>;
  listInvoices(tenantId: string): Promise<Record<string, unknown>[]>;
  listInvoiceLines(tenantId: string): Promise<Record<string, unknown>[]>;
  listShoppingLists(tenantId: string): Promise<Record<string, unknown>[]>;
  listBudgets(tenantId: string): Promise<Record<string, unknown>[]>;
  listReceiptImageKeys(tenantId: string): Promise<ReceiptImageRef[]>;
}
