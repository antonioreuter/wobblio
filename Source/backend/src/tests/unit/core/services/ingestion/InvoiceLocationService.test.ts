import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { InvoiceLocationService } from '@core/services/ingestion/InvoiceLocationService';
import type { IInvoiceRepository, InvoiceRecord, InvoiceReEmission } from '@core/ports/ingestion/IInvoiceRepository';
import type { IRegionReference } from '@core/ports/data-intelligence/IRegionReference';
import type { IContributorContextRepository } from '@core/ports/data-intelligence/IContributorContextRepository';
import type { IPriceObservationStore } from '@core/ports/data-intelligence/IPriceObservationStore';
import {
  InvoiceNotFoundError,
  InvalidLocationError,
  LocationAlreadySetError,
  LocationNotConfirmableError,
} from '@core/domain/errors';
import type { InvoiceStatus } from '@core/domain/ingestion';

const pendingInvoice = (status: InvoiceStatus = 'PARSED'): InvoiceRecord => ({
  id: 'inv-1', tenantId: 'tenant-1', status,
  imageS3Key: 'k', imageSha256: 'h', householdId: null, systemFaultReason: null,
  locationStatus: 'PENDING', locationConfirmedAt: null,
});

const reEmission = (): InvoiceReEmission => ({
  merchantId: 'm1',
  merchantProvisional: false,
  transactionDate: '2026-06-10',
  currency: 'EUR',
  lines: [{
    productId: 'p1', productProvisional: false, baseUnit: 'L',
    normalizedUnitPrice: 2.0, isDepositOrFee: false, quantity: 1, lineTotal: 2.0, listUnitPrice: 2.0,
  }],
});

describe('InvoiceLocationService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let regionReference: MockedObject<IRegionReference>;
  let contributorContext: MockedObject<IContributorContextRepository>;
  let priceObservationStore: MockedObject<IPriceObservationStore>;
  let sut: InvoiceLocationService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(), getById: vi.fn().mockResolvedValue(pendingInvoice()),
      findSameTenantByHash: vi.fn(), findFuzzyDuplicate: vi.fn(), persistParsed: vi.fn(),
      confirmLocation: vi.fn(), getForReEmission: vi.fn().mockResolvedValue(reEmission()),
      markLocationResolved: vi.fn(),
      updateStatus: vi.fn(), softDelete: vi.fn(), listForTenant: vi.fn(), getDetail: vi.fn(),
    };
    regionReference = {
      listCountries: vi.fn(), listSubdivisions: vi.fn(), isValidRegion: vi.fn(),
      isMappedLocation: vi.fn().mockResolvedValue(true),
    };
    contributorContext = {
      getContext: vi.fn().mockResolvedValue({ optedOut: false, regionCode: null, countryCode: 'NL', trustScore: 50 }),
    };
    priceObservationStore = { emit: vi.fn() };
    sut = new InvoiceLocationService(invoiceRepo, regionReference, contributorContext, priceObservationStore);
  });

  it('confirms a mapped location, records it from the user, and emits deferred observations', async () => {
    const status = await sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' });

    expect(status).toBe('RESOLVED');
    expect(invoiceRepo.confirmLocation).toHaveBeenCalledWith({
      invoiceId: 'inv-1', countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'USER',
    });
    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
    const rows = priceObservationStore.emit.mock.calls[0][0];
    expect(rows[0]).toMatchObject({ productId: 'p1', regionCode: 'NL-NB', countryCode: 'NL' });
  });

  it('holds an unmapped location and does not emit', async () => {
    regionReference.isMappedLocation.mockResolvedValue(false);

    const status = await sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-ZZ' });

    expect(status).toBe('HELD_UNMAPPED');
    expect(invoiceRepo.confirmLocation).toHaveBeenCalledWith(expect.objectContaining({ status: 'HELD_UNMAPPED' }));
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('rejects a second confirmation (write-once)', async () => {
    invoiceRepo.getById.mockResolvedValue({ ...pendingInvoice(), locationStatus: 'RESOLVED', locationConfirmedAt: '2026-06-17T00:00:00Z' });

    await expect(sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' }))
      .rejects.toBeInstanceOf(LocationAlreadySetError);
    expect(invoiceRepo.confirmLocation).not.toHaveBeenCalled();
  });

  it('confirms a NEEDS_REVIEW invoice (also a shareable status)', async () => {
    invoiceRepo.getById.mockResolvedValue(pendingInvoice('NEEDS_REVIEW'));

    const status = await sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' });

    expect(status).toBe('RESOLVED');
    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
  });

  it('refuses to confirm a SUSPECTED_DUPLICATE invoice and never emits (§6.8)', async () => {
    invoiceRepo.getById.mockResolvedValue(pendingInvoice('SUSPECTED_DUPLICATE'));

    await expect(sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' }))
      .rejects.toBeInstanceOf(LocationNotConfirmableError);
    expect(invoiceRepo.confirmLocation).not.toHaveBeenCalled();
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('refuses to confirm a still-PROCESSING invoice (avoids the worker-clobber stuck state)', async () => {
    invoiceRepo.getById.mockResolvedValue(pendingInvoice('PROCESSING'));

    await expect(sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' }))
      .rejects.toBeInstanceOf(LocationNotConfirmableError);
    expect(invoiceRepo.confirmLocation).not.toHaveBeenCalled();
  });

  it('rejects a malformed country code', async () => {
    await expect(sut.confirm('inv-1', 'tenant-1', { countryCode: 'NLD', regionCode: '' }))
      .rejects.toBeInstanceOf(InvalidLocationError);
  });

  it('throws when the invoice does not exist', async () => {
    invoiceRepo.getById.mockResolvedValue(null);

    await expect(sut.confirm('missing', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' }))
      .rejects.toBeInstanceOf(InvoiceNotFoundError);
  });

  it('skips emission when the invoice has no re-emittable lines', async () => {
    invoiceRepo.getForReEmission.mockResolvedValue(null);

    const status = await sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' });

    expect(status).toBe('RESOLVED');
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('does not emit when the opted-out contributor yields no rows', async () => {
    contributorContext.getContext.mockResolvedValue({ optedOut: true, regionCode: null, countryCode: 'NL', trustScore: 0 });

    const status = await sut.confirm('inv-1', 'tenant-1', { countryCode: 'NL', regionCode: 'NL-NB' });

    expect(status).toBe('RESOLVED');
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });
});
