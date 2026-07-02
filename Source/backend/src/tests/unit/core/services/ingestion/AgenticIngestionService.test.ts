import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgenticIngestionService } from '@core/services/ingestion/AgenticIngestionService';
import type { ExtractionPreparer } from '@core/services/ingestion/ExtractionPreparer';
import type { InvoiceCoordinator } from '@core/services/ingestion/agentic/InvoiceCoordinator';
import type { InvoiceFinalizer } from '@core/services/ingestion/InvoiceFinalizer';

const MESSAGE = { invoiceId: 'inv-1', tenantId: 'tenant-1', s3Key: 'receipts/tenant-1/abc.jpg' };
const RECEIPT = { merchantRaw: 'AH', transactionDate: '2026-06-10', currency: 'EUR', total: 3, lines: [], parseConfidence: 0.9 };
const LOCATION = { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'RECEIPT' };
const CONTEXT = { optedOut: false, regionCode: 'NL-NB', countryCode: 'NL', trustScore: 50 };
const EXTRACTION = { receipt: RECEIPT, location: LOCATION, merchant: { merchantId: 'm1', brandName: 'AH', provisional: false, confidence: 0.9 }, normalized: [], categoryId: 'groceries', tags: ['t'] };

describe('AgenticIngestionService', () => {
  let preparer: { prepare: ReturnType<typeof vi.fn> };
  let coordinator: { extract: ReturnType<typeof vi.fn> };
  let finalizer: { finalize: ReturnType<typeof vi.fn> };
  let service: AgenticIngestionService;

  beforeEach(() => {
    preparer = { prepare: vi.fn() };
    coordinator = { extract: vi.fn().mockResolvedValue(EXTRACTION) };
    finalizer = { finalize: vi.fn().mockResolvedValue({ handled: true, status: 'PARSED' }) };
    service = new AgenticIngestionService(
      preparer as unknown as ExtractionPreparer,
      coordinator as unknown as InvoiceCoordinator,
      finalizer as unknown as InvoiceFinalizer,
    );
  });

  it('short-circuits a duplicate delivery without extracting or finalizing', async () => {
    preparer.prepare.mockResolvedValue({ kind: 'duplicate' });
    const outcome = await service.process(MESSAGE);
    expect(outcome).toEqual({ handled: false });
    expect(coordinator.extract).not.toHaveBeenCalled();
    expect(finalizer.finalize).not.toHaveBeenCalled();
  });

  it('returns the preparer outcome for an unreadable verdict, skipping the pipeline', async () => {
    const unreadable = { handled: true, status: 'FAILED_PROCESSING', failureReasonCode: 'BLURRY' };
    preparer.prepare.mockResolvedValue({ kind: 'unreadable', outcome: unreadable });
    const outcome = await service.process(MESSAGE);
    expect(outcome).toBe(unreadable);
    expect(coordinator.extract).not.toHaveBeenCalled();
    expect(finalizer.finalize).not.toHaveBeenCalled();
  });

  it('runs prepare → coordinator → finalizer on the happy path', async () => {
    preparer.prepare.mockResolvedValue({ kind: 'ready', receipt: RECEIPT, location: LOCATION, context: CONTEXT });
    const outcome = await service.process(MESSAGE);

    expect(coordinator.extract).toHaveBeenCalledWith(RECEIPT, LOCATION, MESSAGE.invoiceId);
    expect(finalizer.finalize).toHaveBeenCalledWith({ message: MESSAGE, context: CONTEXT, ...EXTRACTION });
    expect(outcome).toEqual({ handled: true, status: 'PARSED' });
  });
});
