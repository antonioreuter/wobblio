import type { InvoiceStatus } from '@core/domain/ingestion';

export interface CreatePendingInvoice {
  tenantId: string;
  uploadedByUserId: string;
  householdId: string | null;
  imageS3Key: string;
  imageSha256: string;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  status: InvoiceStatus;
  imageS3Key: string;
  imageSha256: string;
  householdId: string | null;
}

export interface PersistedLine {
  rawText: string;
  productId: string | null;
  categoryId: string | null;
  quantity: number;
  packQuantity: number | null;
  baseUnit: 'KG' | 'L' | 'PIECE' | null;
  unitPrice: number | null;
  normalizedUnitPrice: number | null;
  lineTotal: number;
  isDiscount: boolean;
  isDepositOrFee: boolean;
  confidence: number;
}

export interface PersistParsedInvoice {
  invoiceId: string;
  merchantId: string | null;
  branchId: string | null;
  transactionDate: string;
  currency: string;
  total: number;
  categoryId: string | null;
  searchTags: string[];
  status: InvoiceStatus;
  lines: PersistedLine[];
}

export interface FuzzyFingerprint {
  merchantId: string | null;
  transactionDate: string;
  total: number;
  lineCount: number;
}

export interface InvoiceListItem {
  id: string;
  status: InvoiceStatus;
  merchantName: string | null;
  categoryId: string | null;
  transactionDate: string | null;
  total: number | null;
  currency: string | null;
  searchTags: string[];
  createdAt: string;
}

export interface InvoiceDetailLine {
  rawText: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
}

export interface InvoiceDetail extends InvoiceListItem {
  imageS3Key: string;
  lines: InvoiceDetailLine[];
}

export interface IInvoiceRepository {
  createPending(input: CreatePendingInvoice): Promise<string>;
  getById(invoiceId: string): Promise<InvoiceRecord | null>;
  findSameTenantByHash(imageSha256: string): Promise<InvoiceRecord | null>;
  findFuzzyDuplicate(invoiceId: string, fingerprint: FuzzyFingerprint): Promise<boolean>;
  persistParsed(input: PersistParsedInvoice): Promise<void>;
  updateStatus(invoiceId: string, status: InvoiceStatus): Promise<void>;
  listForTenant(limit: number): Promise<InvoiceListItem[]>;
  getDetail(invoiceId: string): Promise<InvoiceDetail | null>;
}
