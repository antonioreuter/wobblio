import type { IInvoiceRepository, InvoiceDetail } from '../../ports/ingestion/IInvoiceRepository';
import type { IBillSplitRepository, BillSplitMeta, LineAllocationInput } from '../../ports/splitting/IBillSplitRepository';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import {
  computeSplitSummary,
  type SplitAllocation,
  type SplitLine,
  type SplitSummary,
} from '../../domain/billSplit';
import { InvoiceNotFoundError, BillSplitNotFoundError, InvalidSplitError } from '../../domain/errors';

const UNIT_EPSILON = 1e-3;

export interface SplitView {
  id: string;
  invoiceId: string;
  allocations: { lineId: string; participantName: string; units: number }[];
}

export interface LineAllocation {
  participantName: string;
  units: number;
}

// Bill splitting on a parsed invoice (§11, Premium). Participant names are field-level encrypted
// (invariant #9) — encrypted on assign, decrypted only in memory for read/summary/export.
export class BillSplitService {
  constructor(
    private readonly invoices: IInvoiceRepository,
    private readonly splits: IBillSplitRepository,
    private readonly encryption: IKmsEncryption,
  ) {}

  async createSplit(invoiceId: string): Promise<{ splitId: string }> {
    const invoice = await this.invoices.getDetail(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);
    return { splitId: await this.splits.create(invoiceId) };
  }

  async getSplit(splitId: string): Promise<SplitView> {
    const meta = await this.requireMeta(splitId);
    const allocations = await this.decryptedAllocations(splitId);
    return { id: meta.id, invoiceId: meta.invoiceId, allocations };
  }

  // Replace the whole allocation set for one line: several participants may each take a quantity of
  // the line's units (e.g. 3 items → 2 to Alice, 1 to Bob); the unallocated remainder stays with "You".
  async setLineAllocations(splitId: string, lineId: string, allocations: LineAllocation[]): Promise<void> {
    const meta = await this.requireMeta(splitId);
    const invoice = await this.requireInvoice(meta.invoiceId);
    const line = invoice.lines.find((l) => l.id === lineId);
    if (!line) throw new InvalidSplitError('line does not belong to this invoice');
    if (line.isDiscount || line.isDepositOrFee) throw new InvalidSplitError('discount and fee lines are not assignable');

    const cleaned = this.validateAllocations(allocations, line.quantity);
    const encrypted: LineAllocationInput[] = await Promise.all(
      cleaned.map(async (a) => ({ participantNameEnc: await this.encryption.encrypt(a.participantName), units: a.units })),
    );
    await this.splits.setLineAllocations(splitId, lineId, encrypted);
  }

  // Merge same-named allocations, reject "You"/blank names and non-positive units, and cap the
  // total at the line's printed quantity so the remainder-to-owner arithmetic can never go negative.
  private validateAllocations(allocations: LineAllocation[], lineQuantity: number): LineAllocation[] {
    const byName = new Map<string, number>();
    for (const a of allocations) {
      const name = a.participantName?.trim() ?? '';
      if (!name) throw new InvalidSplitError('participant name is required');
      if (name.toLowerCase() === 'you') throw new InvalidSplitError('"You" is reserved and cannot be assigned to');
      if (!(a.units > 0)) throw new InvalidSplitError('units must be greater than 0');
      byName.set(name, (byName.get(name) ?? 0) + a.units);
    }
    const capacity = lineQuantity > 0 ? lineQuantity : 1;
    const total = [...byName.values()].reduce((sum, u) => sum + u, 0);
    if (total > capacity + UNIT_EPSILON) throw new InvalidSplitError('allocated units exceed the line quantity');
    return [...byName.entries()].map(([participantName, units]) => ({ participantName, units }));
  }

  async summary(splitId: string): Promise<SplitSummary> {
    const { summary } = await this.buildSummary(splitId);
    return summary;
  }

  async whatsAppExport(splitId: string): Promise<{ text: string }> {
    const { invoice, summary } = await this.buildSummary(splitId);
    return { text: formatWhatsApp(invoice, summary) };
  }

  // Read model for the public /s/<token> share page — the per-person breakdown plus
  // the invoice header the page needs (merchant, date, currency).
  async sharedSummary(splitId: string): Promise<{
    merchant: string | null;
    date: string | null;
    currency: string | null;
    summary: SplitSummary;
  }> {
    const { invoice, summary } = await this.buildSummary(splitId);
    return { merchant: invoice.merchantName, date: invoice.transactionDate, currency: invoice.currency, summary };
  }

  private async buildSummary(splitId: string): Promise<{ invoice: InvoiceDetail; summary: SplitSummary }> {
    const meta = await this.requireMeta(splitId);
    const invoice = await this.requireInvoice(meta.invoiceId);
    const allocations = await this.decryptedAllocations(splitId);
    const lines: SplitLine[] = invoice.lines.map((l) => ({
      id: l.id,
      label: l.rawText,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      isDiscount: l.isDiscount,
      isDepositOrFee: l.isDepositOrFee,
    }));
    return { invoice, summary: computeSplitSummary(lines, allocations, invoice.total ?? 0) };
  }

  private async decryptedAllocations(splitId: string): Promise<SplitAllocation[]> {
    const stored = await this.splits.listAllocations(splitId);
    return Promise.all(
      stored.map(async (a) => ({
        lineId: a.lineId,
        participantName: await this.encryption.decrypt(a.participantNameEnc),
        units: a.units,
      })),
    );
  }

  private async requireMeta(splitId: string): Promise<BillSplitMeta> {
    const meta = await this.splits.getMeta(splitId);
    if (!meta) throw new BillSplitNotFoundError(splitId);
    return meta;
  }

  private async requireInvoice(invoiceId: string): Promise<InvoiceDetail> {
    const invoice = await this.invoices.getDetail(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);
    return invoice;
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', GBP: '£', USD: '$' };

function money(amount: number, currency: string | null): string {
  const symbol = currency ? CURRENCY_SYMBOLS[currency] : undefined;
  return symbol ? `${symbol}${amount.toFixed(2)}` : `${currency ?? ''} ${amount.toFixed(2)}`.trim();
}

function formatWhatsApp(invoice: InvoiceDetail, summary: SplitSummary): string {
  const currency = invoice.currency;
  const header = `🧾 ${invoice.merchantName ?? 'Receipt'} — ${invoice.transactionDate ?? ''}`.trimEnd();
  const blocks = summary.participants.map((p) => {
    const items = p.items.map((i) => `  • ${i.label} ×${i.qty} — ${money(i.amount, currency)}`);
    return [
      `${p.name}: ${money(p.subtotal, currency)}`,
      ...items,
      `  + fees: ${money(p.fees, currency)}`,
      `  Total: ${money(p.total, currency)}`,
    ].join('\n');
  });
  return [header, '', blocks.join('\n\n'), '', `Total: ${money(summary.grandTotal, currency)}`].join('\n');
}
