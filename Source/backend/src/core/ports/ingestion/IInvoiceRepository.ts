import type { InvoiceStatus, InvoiceVerdict } from '@core/domain/ingestion';
import type { InvoiceLocationStatus, LocationSource } from '@core/domain/region';
import type { ObservationLine } from '@core/domain/priceObservation';

export interface CreatePendingInvoice {
  tenantId: string;
  uploadedByUserId: string;
  householdId: string | null;
  imageS3Key: string;
  imageSha256: string;
  // Coarse upload geolocation (tier 2), reverse-geocoded at presign. Null when the
  // browser denied/lacked geolocation. Raw coordinates are never persisted.
  uploadCountryCode: string | null;
  uploadRegionCode: string | null;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  status: InvoiceStatus;
  imageS3Key: string;
  imageSha256: string;
  householdId: string | null;
  locationStatus: InvoiceLocationStatus;
  locationConfirmedAt: string | null;
  // The tier-2 upload-geo candidate the worker reads to decide the sharing location.
  uploadCountryCode: string | null;
  uploadRegionCode: string | null;
}

export interface PersistedLine {
  rawText: string;
  lineIndex: number; // 0-based position on the receipt, preserves discount↔product order
  productId: string | null;
  productProvisional: boolean;
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

export interface InvoiceLocation {
  countryCode: string | null;
  regionCode: string | null;
  status: InvoiceLocationStatus;
  source: LocationSource | null;
}

export interface PersistParsedInvoice {
  invoiceId: string;
  merchantId: string | null;
  merchantProvisional: boolean;
  branchId: string | null;
  transactionDate: string;
  currency: string;
  total: number;
  categoryId: string | null;
  searchTags: string[];
  status: InvoiceStatus;
  // True when this invoice must never reach the price index (e.g. an exact re-upload of
  // a previously-deleted invoice whose observations were already emitted, §6.5).
  priceEmissionBlocked: boolean;
  location: InvoiceLocation;
  lines: PersistedLine[];
}

export interface ConfirmLocationInput {
  invoiceId: string;
  countryCode: string;
  regionCode: string;
  status: InvoiceLocationStatus;
  source: LocationSource;
}

// Everything needed to rebuild de-identified observations for a held invoice at
// confirmation time, read back from the persisted invoice + invoice_line rows.
export interface InvoiceReEmission {
  merchantId: string | null;
  merchantProvisional: boolean;
  transactionDate: string;
  currency: string;
  lines: ObservationLine[];
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
  categoryName: string | null;
  transactionDate: string | null;
  total: number | null;
  currency: string | null;
  searchTags: string[];
  searchTagLabels: string[];
  createdAt: string;
  locationStatus: InvoiceLocationStatus;
  locationCountryCode: string | null;
  locationRegionCode: string | null;
}

export interface InvoiceDetailLine {
  rawText: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  categoryName: string | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  imageS3Key: string;
  lines: InvoiceDetailLine[];
  // The tenant's accuracy verdict on this receipt, or null if never rated.
  feedbackVerdict: InvoiceVerdict | null;
}

export interface IInvoiceRepository {
  createPending(input: CreatePendingInvoice): Promise<string>;
  getById(invoiceId: string): Promise<InvoiceRecord | null>;
  findSameTenantByHash(imageSha256: string): Promise<InvoiceRecord | null>;
  findFuzzyDuplicate(invoiceId: string, fingerprint: FuzzyFingerprint): Promise<boolean>;
  // True when another same-tenant invoice with this one's image hash already reached
  // a RESOLVED location (i.e. already emitted observations) — the exact re-upload guard.
  hasEmittedDuplicateByHash(invoiceId: string): Promise<boolean>;
  persistParsed(input: PersistParsedInvoice): Promise<void>;
  // Write-once location confirmation; rebuild inputs for deferred emission.
  confirmLocation(input: ConfirmLocationInput): Promise<void>;
  getForReEmission(invoiceId: string): Promise<InvoiceReEmission | null>;
  // Flips a held invoice to RESOLVED after its region is mapped and re-emitted.
  markLocationResolved(invoiceId: string): Promise<void>;
  updateStatus(invoiceId: string, status: InvoiceStatus): Promise<void>;
  // Hides the invoice from the tenant's list by flipping its status to DISCARDED.
  softDelete(invoiceId: string): Promise<void>;
  listForTenant(limit: number): Promise<InvoiceListItem[]>;
  getDetail(invoiceId: string): Promise<InvoiceDetail | null>;
}
