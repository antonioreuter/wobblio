import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { CorrectInvoiceService } from '@core/services/ingestion/CorrectInvoiceService';
import type {
  CorrectInvoiceInput,
  IInvoiceRepository,
  InvoiceRecord,
} from '@core/ports/ingestion/IInvoiceRepository';
import {
  InvalidCorrectionError,
  InvoiceNotCorrectableError,
  InvoiceNotFoundError,
} from '@core/domain/errors';

const parsed = { id: 'inv-1', tenantId: 'tenant-1', status: 'NEEDS_REVIEW' } as InvoiceRecord;

const input = (overrides: Partial<CorrectInvoiceInput> = {}): CorrectInvoiceInput => ({
  invoiceId: 'inv-1',
  transactionDate: '2026-06-30',
  total: 12.5,
  lines: [{ id: 'line-1', productId: 'prod-1', quantity: 2, unitPrice: 1.5, lineTotal: 3 }],
  ...overrides,
});

describe('CorrectInvoiceService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let sut: CorrectInvoiceService;

  beforeEach(() => {
    invoiceRepo = {
      getById: vi.fn(),
      applyCorrection: vi.fn(),
    } as unknown as MockedObject<IInvoiceRepository>;
    sut = new CorrectInvoiceService(invoiceRepo);
  });

  it('throws InvoiceNotFoundError for an unknown (or cross-tenant) invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(null);
    await expect(sut.correct(input())).rejects.toBeInstanceOf(InvoiceNotFoundError);
    expect(invoiceRepo.applyCorrection).not.toHaveBeenCalled();
  });

  it('rejects correcting an invoice that is still processing', async () => {
    invoiceRepo.getById.mockResolvedValue({ ...parsed, status: 'PROCESSING' } as InvoiceRecord);
    await expect(sut.correct(input())).rejects.toBeInstanceOf(InvoiceNotCorrectableError);
    expect(invoiceRepo.applyCorrection).not.toHaveBeenCalled();
  });

  it('rejects a negative total before touching the database', async () => {
    await expect(sut.correct(input({ total: -1 }))).rejects.toBeInstanceOf(InvalidCorrectionError);
    expect(invoiceRepo.getById).not.toHaveBeenCalled();
  });

  it('rejects a non-positive line quantity', async () => {
    const bad = input({ lines: [{ id: 'l', productId: null, quantity: 0, unitPrice: null, lineTotal: 1 }] });
    await expect(sut.correct(bad)).rejects.toBeInstanceOf(InvalidCorrectionError);
    expect(invoiceRepo.getById).not.toHaveBeenCalled();
  });

  it('rejects a negative line total', async () => {
    const bad = input({ lines: [{ id: 'l', productId: null, quantity: 1, unitPrice: null, lineTotal: -1 }] });
    await expect(sut.correct(bad)).rejects.toBeInstanceOf(InvalidCorrectionError);
    expect(invoiceRepo.getById).not.toHaveBeenCalled();
  });

  it('applies the correction for a correctable invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(parsed);
    const payload = input();
    await sut.correct(payload);
    expect(invoiceRepo.applyCorrection).toHaveBeenCalledWith(payload);
  });

  it('accepts a null total (whole-receipt total left blank)', async () => {
    invoiceRepo.getById.mockResolvedValue(parsed);
    const payload = input({ total: null });
    await sut.correct(payload);
    expect(invoiceRepo.applyCorrection).toHaveBeenCalledWith(payload);
  });
});
