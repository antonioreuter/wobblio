import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { HeldInvoiceReleaseService } from '@core/services/ingestion/HeldInvoiceReleaseService';
import type { IInvoiceRepository, InvoiceReEmission } from '@core/ports/ingestion/IInvoiceRepository';
import type { ReleasableHeldInvoice } from '@core/ports/ingestion/IReleasableHeldInvoiceReader';
import type { IContributorContextRepository } from '@core/ports/data-intelligence/IContributorContextRepository';
import type { IPriceObservationStore } from '@core/ports/data-intelligence/IPriceObservationStore';

const candidate: ReleasableHeldInvoice = {
  invoiceId: 'inv-1', tenantId: 'tenant-1', countryCode: 'PT', regionCode: 'PT-11',
};

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

describe('HeldInvoiceReleaseService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let contributorContext: MockedObject<IContributorContextRepository>;
  let priceObservationStore: MockedObject<IPriceObservationStore>;
  let sut: HeldInvoiceReleaseService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(), getById: vi.fn(), findSameTenantByHash: vi.fn(),
      findFuzzyDuplicate: vi.fn(), persistParsed: vi.fn(), confirmLocation: vi.fn(),
      getForReEmission: vi.fn().mockResolvedValue(reEmission()), markLocationResolved: vi.fn(),
      updateStatus: vi.fn(), softDelete: vi.fn(), listForTenant: vi.fn(), getDetail: vi.fn(),
    };
    contributorContext = {
      getContext: vi.fn().mockResolvedValue({ optedOut: false, regionCode: null, countryCode: 'PT', trustScore: 50 }),
    };
    priceObservationStore = { emit: vi.fn() };
    sut = new HeldInvoiceReleaseService(invoiceRepo, contributorContext, priceObservationStore);
  });

  it('re-emits with the invoice stored region and marks the invoice resolved', async () => {
    const emitted = await sut.releaseInvoice(candidate);

    expect(emitted).toBe(true);
    const rows = priceObservationStore.emit.mock.calls[0][0];
    expect(rows[0]).toMatchObject({ productId: 'p1', regionCode: 'PT-11', countryCode: 'PT' });
    expect(invoiceRepo.markLocationResolved).toHaveBeenCalledWith('inv-1');
  });

  it('resolves without emitting when the invoice has no re-emittable lines', async () => {
    invoiceRepo.getForReEmission.mockResolvedValue(null);

    const emitted = await sut.releaseInvoice(candidate);

    expect(emitted).toBe(false);
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
    expect(invoiceRepo.markLocationResolved).toHaveBeenCalledWith('inv-1');
  });

  it('still resolves (no emit) when the contributor has opted out', async () => {
    contributorContext.getContext.mockResolvedValue({ optedOut: true, regionCode: null, countryCode: 'PT', trustScore: 0 });

    const emitted = await sut.releaseInvoice(candidate);

    expect(emitted).toBe(false);
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
    expect(invoiceRepo.markLocationResolved).toHaveBeenCalledWith('inv-1');
  });
});
