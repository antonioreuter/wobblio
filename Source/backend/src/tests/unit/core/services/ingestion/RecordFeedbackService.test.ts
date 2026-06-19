import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { RecordFeedbackService } from '@core/services/ingestion/RecordFeedbackService';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IInvoiceFeedbackRepository } from '@core/ports/ingestion/IInvoiceFeedbackRepository';
import { InvalidFeedbackError, InvoiceNotFoundError } from '@core/domain/errors';

const record = { id: 'inv-1', tenantId: 'tenant-1', status: 'PARSED' } as InvoiceRecord;

describe('RecordFeedbackService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let feedbackRepo: MockedObject<IInvoiceFeedbackRepository>;
  let sut: RecordFeedbackService;

  beforeEach(() => {
    invoiceRepo = { getById: vi.fn() } as unknown as MockedObject<IInvoiceRepository>;
    feedbackRepo = { upsert: vi.fn(), getVerdict: vi.fn() };
    sut = new RecordFeedbackService(invoiceRepo, feedbackRepo);
  });

  it('rejects a verdict that is not UP or DOWN before touching the database', async () => {
    await expect(sut.record('inv-1', 'maybe')).rejects.toBeInstanceOf(InvalidFeedbackError);
    expect(invoiceRepo.getById).not.toHaveBeenCalled();
    expect(feedbackRepo.upsert).not.toHaveBeenCalled();
  });

  it('throws InvoiceNotFoundError for an unknown (or cross-tenant) invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(null);

    await expect(sut.record('ghost', 'UP')).rejects.toBeInstanceOf(InvoiceNotFoundError);
    expect(feedbackRepo.upsert).not.toHaveBeenCalled();
  });

  it('upserts the verdict for a visible invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(record);

    await sut.record('inv-1', 'DOWN');

    expect(feedbackRepo.upsert).toHaveBeenCalledWith('inv-1', 'DOWN');
  });
});
