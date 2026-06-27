import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { PresignService } from '@core/services/ingestion/PresignService';
import { QuotaService } from '@core/services/quota/QuotaService';
import { UploadAllowanceResolver, type UploadAllowance } from '@core/services/quota/UploadAllowanceResolver';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IQuotaRepository } from '@core/ports/quota/IQuotaRepository';
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
  counter: 'UPLOADS',
  quotaOwnerId: 'tenant-1',
  cap: 3,
};

describe('PresignService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let quotaRepo: MockedObject<IQuotaRepository>;
  let resolver: MockedObject<UploadAllowanceResolver>;
  let storage: MockedObject<IS3FileStorage>;
  let reverseGeocoder: MockedObject<IReverseGeocoder>;
  let regionReference: MockedObject<IRegionReference>;
  let sut: PresignService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(),
      getById: vi.fn(),
      findSameTenantByHash: vi.fn().mockResolvedValue(null),
      findFuzzyDuplicate: vi.fn(),
      persistParsed: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    quotaRepo = { getUsed: vi.fn().mockResolvedValue(0), increment: vi.fn() };
    resolver = { resolve: vi.fn().mockResolvedValue(personalAllowance) } as unknown as MockedObject<UploadAllowanceResolver>;
    storage = { presignPut: vi.fn().mockResolvedValue('https://s3/put'), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    reverseGeocoder = { reverseGeocode: vi.fn() };
    regionReference = {
      listCountries: vi.fn(), listSubdivisions: vi.fn(), isValidRegion: vi.fn(),
      isMappedLocation: vi.fn(), resolveReceiptLocation: vi.fn(),
    };
    sut = new PresignService(invoiceRepo, new QuotaService(quotaRepo), resolver, storage, reverseGeocoder, regionReference);
  });

  it('rejects a same-tenant duplicate without resolving allowance or creating an invoice', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue({ id: 'inv-old' } as InvoiceRecord);

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(DuplicateInvoiceError);
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
    expect(quotaRepo.increment).not.toHaveBeenCalled();
  });

  it('issues a presigned URL for a personal upload and reserves the personal quota', async () => {
    invoiceRepo.createPending.mockResolvedValue('inv-1');

    const result = await sut.presign(baseInput);

    expect(result).toEqual({ invoiceId: 'inv-1', uploadUrl: 'https://s3/put', s3Key: `receipts/tenant-1/${SHA}.jpg` });
    expect(resolver.resolve).toHaveBeenCalledWith({ userId: 'tenant-1', role: 'STANDARD' });
    expect(quotaRepo.increment).toHaveBeenCalledWith('tenant-1', 'UPLOADS', expect.any(String));
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(expect.objectContaining({ householdId: null }));
    expect(storage.presignPut).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.jpg`, 'image/jpeg', 300);
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
    expect(storage.presignPut).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.pdf`, 'application/pdf', 300);
  });

  it('reserves the shared pool and stamps the household when the resolver returns a pool allowance', async () => {
    resolver.resolve.mockResolvedValue({
      householdId: 'hh-1', isPool: true, counter: 'HOUSEHOLD_UPLOADS', quotaOwnerId: 'hh-1', cap: 15,
    });
    quotaRepo.getUsed.mockResolvedValue(5);
    invoiceRepo.createPending.mockResolvedValue('inv-2');

    await sut.presign(baseInput);

    // The shared pool counter is keyed by household_id, not the uploader.
    expect(quotaRepo.increment).toHaveBeenCalledWith('hh-1', 'HOUSEHOLD_UPLOADS', expect.any(String));
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(expect.objectContaining({ householdId: 'hh-1' }));
  });

  it('stamps the household but charges the personal counter for a solo-household allowance', async () => {
    resolver.resolve.mockResolvedValue({
      householdId: 'hh-1', isPool: false, counter: 'UPLOADS', quotaOwnerId: 'tenant-1', cap: 3,
    });
    invoiceRepo.createPending.mockResolvedValue('inv-solo');

    await sut.presign(baseInput);

    expect(quotaRepo.increment).toHaveBeenCalledWith('tenant-1', 'UPLOADS', expect.any(String));
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(expect.objectContaining({ householdId: 'hh-1' }));
  });

  it('throws QuotaExceededError when the resolved cap is reached', async () => {
    quotaRepo.getUsed.mockResolvedValue(3); // cap is 3 (personal allowance)

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
