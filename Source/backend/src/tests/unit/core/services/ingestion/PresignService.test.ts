import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { PresignService } from '@core/services/ingestion/PresignService';
import { QuotaService } from '@core/services/quota/QuotaService';
import { UploadAllowanceResolver, type UploadAllowance } from '@core/services/quota/UploadAllowanceResolver';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IQuotaRepository } from '@core/ports/quota/IQuotaRepository';
import type { IUploadQuotaProvider } from '@core/ports/quota/IUploadQuotaProvider';
import type { IUploadLimitsProvider } from '@core/ports/quota/IUploadLimitsProvider';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IReverseGeocoder } from '@core/ports/data-intelligence/IReverseGeocoder';
import type { IRegionReference } from '@core/ports/data-intelligence/IRegionReference';
import {
  DuplicateInvoiceError,
  PremiumRequiredError,
  QuotaExceededError,
  UnsupportedUploadTypeError,
} from '@core/domain/errors';

const SHA = 'a'.repeat(64);

const baseInput = {
  tenantId: 'tenant-1',
  uploadedByUserId: 'tenant-1',
  role: 'STANDARD' as const,
  imageSha256: SHA,
  contentType: 'image/jpeg',
};

const personalAllowance: UploadAllowance = {
  householdId: null,
  isPool: false,
  counter: 'CREDITS',
  quotaOwnerId: 'tenant-1',
  cap: 30_000, // 3 invoices × 10k avg tokens
};

describe('PresignService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let quotaRepo: MockedObject<IQuotaRepository>;
  let quotaProvider: MockedObject<IUploadQuotaProvider>;
  let limitsProvider: MockedObject<IUploadLimitsProvider>;
  let resolver: MockedObject<UploadAllowanceResolver>;
  let storage: MockedObject<IS3FileStorage>;
  let reverseGeocoder: MockedObject<IReverseGeocoder>;
  let regionReference: MockedObject<IRegionReference>;
  let sut: PresignService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(),
      getById: vi.fn(),
      countInFlightUploads: vi.fn().mockResolvedValue(0),
      findSameTenantByHash: vi.fn().mockResolvedValue(null),
      findFuzzyDuplicate: vi.fn(),
      persistParsed: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    quotaRepo = { getUsed: vi.fn().mockResolvedValue(0), increment: vi.fn(), decrement: vi.fn() };
    quotaProvider = {
      getPersonalUploadsCap: vi.fn(),
      getHouseholdUploadsCap: vi.fn(),
      getAverageTokensPerInvoice: vi.fn().mockResolvedValue(10_000),
    };
    limitsProvider = {
      getMaxImageBytes: vi.fn().mockResolvedValue(5_000_000),
      getMaxPdfBytes: vi.fn().mockResolvedValue(4_500_000),
      getMaxPdfPages: vi.fn().mockResolvedValue(10),
    };
    resolver = { resolve: vi.fn().mockResolvedValue(personalAllowance) } as unknown as MockedObject<UploadAllowanceResolver>;
    storage = { presignPost: vi.fn().mockResolvedValue({ url: 'https://s3/post', fields: { key: 'k' } }), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    reverseGeocoder = { reverseGeocode: vi.fn() };
    regionReference = {
      listCountries: vi.fn(), listSubdivisions: vi.fn(), isValidRegion: vi.fn(),
      isMappedLocation: vi.fn(), resolveReceiptLocation: vi.fn(),
    };
    sut = new PresignService(invoiceRepo, new QuotaService(quotaRepo), resolver, quotaProvider, limitsProvider, storage, reverseGeocoder, regionReference);
  });

  it('rejects a same-tenant duplicate without resolving allowance or creating an invoice', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue({ id: 'inv-old' } as InvoiceRecord);

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(DuplicateInvoiceError);
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
    expect(quotaRepo.increment).not.toHaveBeenCalled();
  });

  it('issues a presigned URL for a personal upload without charging at presign', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-1');

    const result = await sut.presign(baseInput);

    expect(result).toEqual({ invoiceId: 'inv-1', url: 'https://s3/post', fields: { key: 'k' }, s3Key: `receipts/tenant-1/${SHA}.jpg` });
    expect(resolver.resolve).toHaveBeenCalledWith({ userId: 'tenant-1', role: 'STANDARD' });
    // Presign is read-only — the worker charges actual tokens at success-time.
    expect(quotaRepo.increment).not.toHaveBeenCalled();
    expect(quotaRepo.getUsed).toHaveBeenCalledWith('tenant-1', 'CREDITS', expect.any(String));
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(expect.objectContaining({ householdId: null }));
    // Presigned POST with the per-format image byte cap as the content-length-range ceiling.
    expect(storage.presignPost).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.jpg`, 'image/jpeg', 5_000_000, 300);
  });

  it('rejects an unsupported content type before any allowance or invoice work', async () => {
    await expect(sut.presign({ ...baseInput, contentType: 'image/gif' })).rejects.toBeInstanceOf(UnsupportedUploadTypeError);
    expect(invoiceRepo.findSameTenantByHash).not.toHaveBeenCalled();
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('rejects a PDF upload for a STANDARD user', async () => {
    await expect(sut.presign({ ...baseInput, contentType: 'application/pdf' })).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(invoiceRepo.findSameTenantByHash).not.toHaveBeenCalled();
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('issues a .pdf key for a premium PDF upload', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-pdf');

    const result = await sut.presign({ ...baseInput, role: 'PREMIUM', contentType: 'application/pdf' });

    expect(result.s3Key).toBe(`receipts/tenant-1/${SHA}.pdf`);
    // PDF gets the larger per-format byte cap on the presigned POST.
    expect(storage.presignPost).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.pdf`, 'application/pdf', 4_500_000, 300);
  });

  it('checks the shared pool counter and stamps the household for a pool allowance', async () => {
    resolver.resolve.mockResolvedValue({
      householdId: 'hh-1', isPool: true, counter: 'HOUSEHOLD_CREDITS', quotaOwnerId: 'hh-1', cap: 150_000,
    });
    quotaRepo.getUsed.mockResolvedValue(50_000);
    invoiceRepo.createPending.mockResolvedValue('inv-2');

    await sut.presign(baseInput);

    // The shared pool counter is keyed by household_id, not the uploader; in-flight
    // projection counts the household's PROCESSING uploads.
    expect(quotaRepo.getUsed).toHaveBeenCalledWith('hh-1', 'HOUSEHOLD_CREDITS', expect.any(String));
    expect(invoiceRepo.countInFlightUploads).toHaveBeenCalledWith('hh-1', true, expect.any(String));
    expect(quotaRepo.increment).not.toHaveBeenCalled();
    // The pool decision is persisted so the worker charges HOUSEHOLD_CREDITS regardless of
    // a membership change before processing.
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', quotaPooled: true }),
    );
  });

  it('checks the personal counter but stamps the household for a solo-household allowance', async () => {
    resolver.resolve.mockResolvedValue({
      householdId: 'hh-1', isPool: false, counter: 'CREDITS', quotaOwnerId: 'tenant-1', cap: 30_000,
    });
    invoiceRepo.createPending.mockResolvedValue('inv-solo');

    await sut.presign(baseInput);

    expect(quotaRepo.getUsed).toHaveBeenCalledWith('tenant-1', 'CREDITS', expect.any(String));
    // Stamped to the household for sharing, but charged personally — quotaPooled false.
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', quotaPooled: false }),
    );
  });

  it('throws QuotaExceededError when the resolved cap is reached', async () => {
    quotaRepo.getUsed.mockResolvedValue(30_000); // cap is 30k (personal allowance)

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('blocks a burst: in-flight uploads project over the cap even when stored usage is under', async () => {
    quotaRepo.getUsed.mockResolvedValue(25_000); // under the 30k cap on its own
    invoiceRepo.countInFlightUploads.mockResolvedValue(1); // +1 × 10k avg = 35k projected

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('reverse-geocodes upload coordinates and stores the resolved coarse location', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    reverseGeocoder.reverseGeocode.mockResolvedValue({ countryCode: 'NL', regionText: 'Noord-Brabant' });
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: 'NL', regionCode: 'NL-NB' });

    await sut.presign({ ...baseInput, coordinates: { lat: 51.4, lon: 5.5 } });

    expect(reverseGeocoder.reverseGeocode).toHaveBeenCalledWith(51.4, 5.5);
    expect(regionReference.resolveReceiptLocation).toHaveBeenCalledWith({ countryCode: 'NL', regionText: 'Noord-Brabant' });
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: 'NL', uploadRegionCode: 'NL-NB' }),
    );
  });

  it('passes an undefined region text to region resolution when the geocoder gives no subdivision', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    reverseGeocoder.reverseGeocode.mockResolvedValue({ countryCode: 'NL', regionText: null });
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: 'NL', regionCode: null });

    await sut.presign({ ...baseInput, coordinates: { lat: 51.4, lon: 5.5 } });

    expect(regionReference.resolveReceiptLocation).toHaveBeenCalledWith({ countryCode: 'NL', regionText: undefined });
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: 'NL', uploadRegionCode: null }),
    );
  });

  it('stores null upload location when the geocoder cannot resolve the coordinates', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    reverseGeocoder.reverseGeocode.mockResolvedValue(null);

    await sut.presign({ ...baseInput, coordinates: { lat: 51.4, lon: 5.5 } });

    expect(regionReference.resolveReceiptLocation).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: null, uploadRegionCode: null }),
    );
  });

  it('stores null upload location and skips geocoding when no coordinates are given', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-1');

    await sut.presign(baseInput);

    expect(reverseGeocoder.reverseGeocode).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: null, uploadRegionCode: null }),
    );
  });
});
