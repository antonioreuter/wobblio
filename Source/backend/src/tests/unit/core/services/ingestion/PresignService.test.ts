import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { PresignService } from '@core/services/ingestion/PresignService';
import { QuotaService } from '@core/services/quota/QuotaService';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IQuotaRepository } from '@core/ports/quota/IQuotaRepository';
import type { IUploadQuotaProvider } from '@core/ports/quota/IUploadQuotaProvider';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IReverseGeocoder } from '@core/ports/data-intelligence/IReverseGeocoder';
import type { IRegionReference } from '@core/ports/data-intelligence/IRegionReference';
import type { IHouseholdRepository } from '@core/ports/households/IHouseholdRepository';
import {
  DuplicateInvoiceError,
  HouseholdNotFoundError,
  HouseholdPoolUnavailableError,
  PremiumRequiredError,
  QuotaExceededError,
  UnsupportedUploadTypeError,
} from '@core/domain/errors';

const SHA = 'a'.repeat(64);

const baseInput = {
  tenantId: 'tenant-1',
  uploadedByUserId: 'tenant-1',
  role: 'STANDARD' as const,
  householdId: null,
  imageSha256: SHA,
  contentType: 'image/jpeg',
};

describe('PresignService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let quotaRepo: MockedObject<IQuotaRepository>;
  let quotaProvider: MockedObject<IUploadQuotaProvider>;
  let storage: MockedObject<IS3FileStorage>;
  let reverseGeocoder: MockedObject<IReverseGeocoder>;
  let regionReference: MockedObject<IRegionReference>;
  let households: MockedObject<IHouseholdRepository>;
  let sut: PresignService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(),
      getById: vi.fn(),
      findSameTenantByHash: vi.fn(),
      findFuzzyDuplicate: vi.fn(),
      persistParsed: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    quotaRepo = { getUsed: vi.fn(), increment: vi.fn() };
    quotaProvider = { getPersonalUploadsCap: vi.fn(), getHouseholdUploadsCap: vi.fn() };
    storage = { presignPut: vi.fn(), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    reverseGeocoder = { reverseGeocode: vi.fn() };
    regionReference = {
      listCountries: vi.fn(), listSubdivisions: vi.fn(), isValidRegion: vi.fn(),
      isMappedLocation: vi.fn(), resolveReceiptLocation: vi.fn(),
    };
    households = {
      countOwnedByUser: vi.fn(), create: vi.fn(), findMembershipForUser: vi.fn(),
      memberCountForUser: vi.fn(), findForMember: vi.fn(), listMembers: vi.fn(),
      removeMember: vi.fn(), disband: vi.fn(), leave: vi.fn(),
    };
    sut = new PresignService(invoiceRepo, new QuotaService(quotaRepo), quotaProvider, storage, reverseGeocoder, regionReference, households);
  });

  it('rejects a same-tenant duplicate without touching quota or creating an invoice', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue({ id: 'inv-old' } as InvoiceRecord);

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(DuplicateInvoiceError);
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
    expect(quotaRepo.increment).not.toHaveBeenCalled();
  });

  it('issues a presigned URL for a personal upload and reserves the personal quota', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    storage.presignPut.mockResolvedValue('https://s3/put');

    const result = await sut.presign(baseInput);

    expect(result).toEqual({ invoiceId: 'inv-1', uploadUrl: 'https://s3/put', s3Key: `receipts/tenant-1/${SHA}.jpg` });
    expect(quotaProvider.getPersonalUploadsCap).toHaveBeenCalledWith('STANDARD');
    expect(quotaRepo.increment).toHaveBeenCalledWith('tenant-1', 'UPLOADS', expect.any(String));
    expect(storage.presignPut).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.jpg`, 'image/jpeg', 300);
  });

  it('rejects an unsupported content type before any quota or invoice work', async () => {
    await expect(sut.presign({ ...baseInput, contentType: 'image/gif' })).rejects.toBeInstanceOf(UnsupportedUploadTypeError);
    expect(invoiceRepo.findSameTenantByHash).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('rejects a PDF upload for a STANDARD user', async () => {
    await expect(sut.presign({ ...baseInput, contentType: 'application/pdf' })).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(invoiceRepo.findSameTenantByHash).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('issues a .pdf key for a premium PDF upload', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(50);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-pdf');
    storage.presignPut.mockResolvedValue('https://s3/put');

    const result = await sut.presign({ ...baseInput, role: 'PREMIUM', contentType: 'application/pdf' });

    expect(result.s3Key).toBe(`receipts/tenant-1/${SHA}.pdf`);
    expect(storage.presignPut).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.pdf`, 'application/pdf', 300);
  });

  it('reserves the household pool when the household has at least two members', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    households.memberCountForUser.mockResolvedValue(2);
    quotaProvider.getHouseholdUploadsCap.mockResolvedValue(15);
    quotaRepo.getUsed.mockResolvedValue(5);
    invoiceRepo.createPending.mockResolvedValue('inv-2');
    storage.presignPut.mockResolvedValue('https://s3/put');

    await sut.presign({ ...baseInput, householdId: 'hh-1' });

    expect(households.memberCountForUser).toHaveBeenCalledWith('hh-1', 'tenant-1');
    expect(quotaProvider.getHouseholdUploadsCap).toHaveBeenCalled();
    // The shared pool is keyed by household_id, not the uploader.
    expect(quotaRepo.increment).toHaveBeenCalledWith('hh-1', 'HOUSEHOLD_UPLOADS', expect.any(String));
  });

  it('rejects a household upload when the pool is inactive (solo member)', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    households.memberCountForUser.mockResolvedValue(1);

    await expect(sut.presign({ ...baseInput, householdId: 'hh-1' }))
      .rejects.toBeInstanceOf(HouseholdPoolUnavailableError);
    expect(quotaProvider.getHouseholdUploadsCap).not.toHaveBeenCalled();
    expect(quotaRepo.increment).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('rejects a household upload from a non-member', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    households.memberCountForUser.mockResolvedValue(0);

    await expect(sut.presign({ ...baseInput, householdId: 'hh-1' }))
      .rejects.toBeInstanceOf(HouseholdNotFoundError);
    expect(quotaRepo.increment).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('throws QuotaExceededError when the cap is reached', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(3);

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });

  it('reverse-geocodes upload coordinates and stores the resolved coarse location', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    storage.presignPut.mockResolvedValue('https://s3/put');
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
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    storage.presignPut.mockResolvedValue('https://s3/put');
    reverseGeocoder.reverseGeocode.mockResolvedValue({ countryCode: 'NL', regionText: null });
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: 'NL', regionCode: null });

    await sut.presign({ ...baseInput, coordinates: { lat: 51.4, lon: 5.5 } });

    expect(regionReference.resolveReceiptLocation).toHaveBeenCalledWith({ countryCode: 'NL', regionText: undefined });
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: 'NL', uploadRegionCode: null }),
    );
  });

  it('stores null upload location when the geocoder cannot resolve the coordinates', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    storage.presignPut.mockResolvedValue('https://s3/put');
    reverseGeocoder.reverseGeocode.mockResolvedValue(null);

    await sut.presign({ ...baseInput, coordinates: { lat: 51.4, lon: 5.5 } });

    expect(regionReference.resolveReceiptLocation).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: null, uploadRegionCode: null }),
    );
  });

  it('stores null upload location and skips geocoding when no coordinates are given', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    storage.presignPut.mockResolvedValue('https://s3/put');

    await sut.presign(baseInput);

    expect(reverseGeocoder.reverseGeocode).not.toHaveBeenCalled();
    expect(invoiceRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ uploadCountryCode: null, uploadRegionCode: null }),
    );
  });
});
