import { describe, it, expect, beforeEach, vi, type MockedObject } from 'vitest';
import { BillSplitService } from '@core/services/splitting/BillSplitService';
import type { IInvoiceRepository, InvoiceDetail } from '@core/ports/ingestion/IInvoiceRepository';
import type { IBillSplitRepository } from '@core/ports/splitting/IBillSplitRepository';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { InvoiceNotFoundError, BillSplitNotFoundError, InvalidSplitError } from '@core/domain/errors';

const detail = (
  lines: Partial<InvoiceDetail['lines'][number]>[],
  overrides: Partial<Pick<InvoiceDetail, 'merchantName' | 'transactionDate' | 'total' | 'currency'>> = {},
): InvoiceDetail =>
  ({
    id: 'inv-1', merchantName: 'Jumbo', transactionDate: '2026-06-10', total: 20, currency: 'EUR',
    ...overrides,
    lines: lines.map((l, i) => ({
      id: l.id ?? `L${i}`, rawText: l.rawText ?? 'Item', productId: null, quantity: l.quantity ?? 1,
      unitPrice: null, lineTotal: l.lineTotal ?? 10, categoryName: null, confidence: 0.9,
      isDiscount: l.isDiscount ?? false, isDepositOrFee: l.isDepositOrFee ?? false,
    })),
  } as unknown as InvoiceDetail);

describe('BillSplitService', () => {
  let invoices: MockedObject<IInvoiceRepository>;
  let splits: MockedObject<IBillSplitRepository>;
  let encryption: MockedObject<IKmsEncryption>;
  let sut: BillSplitService;

  beforeEach(() => {
    invoices = { getDetail: vi.fn() } as unknown as MockedObject<IInvoiceRepository>;
    splits = {
      create: vi.fn(), getMeta: vi.fn(), listAssignments: vi.fn(),
      upsertAssignment: vi.fn(), removeAssignment: vi.fn(),
    };
    encryption = { encrypt: vi.fn(), decrypt: vi.fn() };
    sut = new BillSplitService(invoices, splits, encryption);
  });

  it('creates a split for a visible invoice', async () => {
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1' }]));
    splits.create.mockResolvedValue('split-1');
    await expect(sut.createSplit('inv-1')).resolves.toEqual({ splitId: 'split-1' });
    expect(splits.create).toHaveBeenCalledWith('inv-1');
  });

  it('throws InvoiceNotFoundError when the invoice is not visible', async () => {
    invoices.getDetail.mockResolvedValue(null);
    await expect(sut.createSplit('ghost')).rejects.toBeInstanceOf(InvoiceNotFoundError);
  });

  it('encrypts the participant name and upserts a product-line assignment', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1', lineTotal: 10 }]));
    encryption.encrypt.mockResolvedValue('enc-alice');

    await sut.assignLine('split-1', 'L1', 'Alice', 0.5);

    expect(encryption.encrypt).toHaveBeenCalledWith('Alice');
    expect(splits.upsertAssignment).toHaveBeenCalledWith('split-1', 'L1', 'enc-alice', 0.5);
  });

  it('rejects a fraction outside (0, 1]', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    await expect(sut.assignLine('split-1', 'L1', 'Alice', 1.5)).rejects.toBeInstanceOf(InvalidSplitError);
    expect(splits.upsertAssignment).not.toHaveBeenCalled();
  });

  it('rejects assigning a deposit/fee line', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'D1', isDepositOrFee: true }]));
    await expect(sut.assignLine('split-1', 'D1', 'Alice', 1)).rejects.toBeInstanceOf(InvalidSplitError);
  });

  it('rejects a line that is not on the invoice', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1' }]));
    await expect(sut.assignLine('split-1', 'other', 'Alice', 1)).rejects.toBeInstanceOf(InvalidSplitError);
  });

  it('rejects an empty participant name', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    await expect(sut.assignLine('split-1', 'L1', '  ', 1)).rejects.toBeInstanceOf(InvalidSplitError);
  });

  it('rejects "You" (any case) as an assignable participant — it is the implicit owner', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    await expect(sut.assignLine('split-1', 'L1', 'You', 1)).rejects.toBeInstanceOf(InvalidSplitError);
    await expect(sut.assignLine('split-1', 'L1', ' YOU ', 1)).rejects.toBeInstanceOf(InvalidSplitError);
    expect(splits.upsertAssignment).not.toHaveBeenCalled();
  });

  it('treats a missing participant name as empty (optional-chaining safety net)', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    await expect(sut.assignLine('split-1', 'L1', undefined as unknown as string, 1)).rejects.toBeInstanceOf(InvalidSplitError);
    expect(splits.upsertAssignment).not.toHaveBeenCalled();
  });

  it('removes an assignment for a known split', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    await sut.removeAssignment('split-1', 'L1');
    expect(splits.removeAssignment).toHaveBeenCalledWith('split-1', 'L1');
  });

  it('throws InvoiceNotFoundError if the invoice is gone by the time a line is assigned', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(null);
    await expect(sut.assignLine('split-1', 'L1', 'Alice', 1)).rejects.toBeInstanceOf(InvoiceNotFoundError);
  });

  it('throws BillSplitNotFoundError for an unknown split', async () => {
    splits.getMeta.mockResolvedValue(null);
    await expect(sut.assignLine('ghost', 'L1', 'Alice', 1)).rejects.toBeInstanceOf(BillSplitNotFoundError);
    await expect(sut.getSplit('ghost')).rejects.toBeInstanceOf(BillSplitNotFoundError);
    await expect(sut.removeAssignment('ghost', 'L1')).rejects.toBeInstanceOf(BillSplitNotFoundError);
  });

  it('decrypts participant names when reading a split', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    splits.listAssignments.mockResolvedValue([{ lineId: 'L1', participantNameEnc: 'enc', fraction: 1 }]);
    encryption.decrypt.mockResolvedValue('Alice');

    const view = await sut.getSplit('split-1');
    expect(view.assignments).toEqual([{ lineId: 'L1', participantName: 'Alice', fraction: 1 }]);
  });

  it('builds a summary from decrypted assignments and invoice lines', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1', lineTotal: 20 }]));
    splits.listAssignments.mockResolvedValue([{ lineId: 'L1', participantNameEnc: 'enc', fraction: 1 }]);
    encryption.decrypt.mockResolvedValue('Alice');

    const summary = await sut.summary('split-1');
    expect(summary.grandTotal).toBe(20);
    expect(summary.participants[0]).toMatchObject({ name: 'Alice', subtotal: 20, total: 20 });
  });

  it('formats a WhatsApp export with the invoice currency symbol', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1', rawText: 'Pizza', lineTotal: 20 }]));
    splits.listAssignments.mockResolvedValue([{ lineId: 'L1', participantNameEnc: 'enc', fraction: 1 }]);
    encryption.decrypt.mockResolvedValue('Alice');

    const { text } = await sut.whatsAppExport('split-1');
    expect(text).toContain('🧾 Jumbo — 2026-06-10');
    expect(text).toContain('Alice: €20.00');
    expect(text).toContain('• Pizza ×1 — €20.00');
    expect(text).toContain('Total: €20.00');
  });

  it('defaults a null invoice total to 0 in the summary grand total', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1', lineTotal: 0 }], { total: null }));
    splits.listAssignments.mockResolvedValue([]);

    const summary = await sut.summary('split-1');
    expect(summary.grandTotal).toBe(0);
  });

  it('falls back to the plain amount (no symbol) when currency has no known mapping', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(detail([{ id: 'L1', rawText: 'Pizza', lineTotal: 20 }], { currency: null }));
    splits.listAssignments.mockResolvedValue([{ lineId: 'L1', participantNameEnc: 'enc', fraction: 1 }]);
    encryption.decrypt.mockResolvedValue('Alice');

    const { text } = await sut.whatsAppExport('split-1');
    expect(text).toContain('Alice: 20.00');
    expect(text).not.toContain('€');
  });

  it('falls back to "Receipt" and no date in the header when both are missing', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    invoices.getDetail.mockResolvedValue(
      detail([{ id: 'L1', lineTotal: 20 }], { merchantName: null, transactionDate: null }),
    );
    splits.listAssignments.mockResolvedValue([{ lineId: 'L1', participantNameEnc: 'enc', fraction: 1 }]);
    encryption.decrypt.mockResolvedValue('Alice');

    const { text } = await sut.whatsAppExport('split-1');
    expect(text).toContain('🧾 Receipt');
    expect(text).not.toContain('2026');
  });
});
