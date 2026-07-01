import type { IInvoiceRepository, InvoiceDetail } from '../../ports/ingestion/IInvoiceRepository';
import type { IBillSplitRepository, BillSplitMeta } from '../../ports/splitting/IBillSplitRepository';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import {
  computeSplitSummary,
  type SplitAssignment,
  type SplitLine,
  type SplitSummary,
} from '../../domain/billSplit';
import { InvoiceNotFoundError, BillSplitNotFoundError, InvalidSplitError } from '../../domain/errors';

export interface SplitView {
  id: string;
  invoiceId: string;
  assignments: { lineId: string; participantName: string; fraction: number }[];
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
    const assignments = await this.decryptedAssignments(splitId);
    return { id: meta.id, invoiceId: meta.invoiceId, assignments };
  }

  async assignLine(splitId: string, lineId: string, participantName: string, fraction = 1): Promise<void> {
    const meta = await this.requireMeta(splitId);
    const name = participantName?.trim() ?? '';
    if (!name) throw new InvalidSplitError('participant name is required');
    // "You" is the synthetic implicit remainder owner computeSplitSummary always
    // adds (billSplit.ts's default ownerLabel) — accepting it here as a real
    // assignment would produce two distinct "You" rows in the summary.
    if (name.toLowerCase() === 'you') throw new InvalidSplitError('"You" is reserved and cannot be assigned to');
    if (!(fraction > 0 && fraction <= 1)) throw new InvalidSplitError('fraction must be in (0, 1]');

    const invoice = await this.requireInvoice(meta.invoiceId);
    const line = invoice.lines.find((l) => l.id === lineId);
    if (!line) throw new InvalidSplitError('line does not belong to this invoice');
    if (line.isDiscount || line.isDepositOrFee) throw new InvalidSplitError('discount and fee lines are not assignable');

    const nameEnc = await this.encryption.encrypt(name);
    await this.splits.upsertAssignment(splitId, lineId, nameEnc, fraction);
  }

  async removeAssignment(splitId: string, lineId: string): Promise<void> {
    await this.requireMeta(splitId);
    await this.splits.removeAssignment(splitId, lineId);
  }

  async summary(splitId: string): Promise<SplitSummary> {
    const { summary } = await this.buildSummary(splitId);
    return summary;
  }

  async whatsAppExport(splitId: string): Promise<{ text: string }> {
    const { invoice, summary } = await this.buildSummary(splitId);
    return { text: formatWhatsApp(invoice, summary) };
  }

  private async buildSummary(splitId: string): Promise<{ invoice: InvoiceDetail; summary: SplitSummary }> {
    const meta = await this.requireMeta(splitId);
    const invoice = await this.requireInvoice(meta.invoiceId);
    const assignments = await this.decryptedAssignments(splitId);
    const lines: SplitLine[] = invoice.lines.map((l) => ({
      id: l.id,
      label: l.rawText,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      isDiscount: l.isDiscount,
      isDepositOrFee: l.isDepositOrFee,
    }));
    return { invoice, summary: computeSplitSummary(lines, assignments, invoice.total ?? 0) };
  }

  private async decryptedAssignments(splitId: string): Promise<SplitAssignment[]> {
    const stored = await this.splits.listAssignments(splitId);
    return Promise.all(
      stored.map(async (a) => ({
        lineId: a.lineId,
        participantName: await this.encryption.decrypt(a.participantNameEnc),
        fraction: a.fraction,
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
