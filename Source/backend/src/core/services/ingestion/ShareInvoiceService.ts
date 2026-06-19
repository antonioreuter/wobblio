import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IInvoiceShareRepository, ResolvedShare } from '../../ports/ingestion/IInvoiceShareRepository';
import type { ISecureToken } from '../../ports/security/ISecureToken';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import { InvoiceNotFoundError, InvalidShareError } from '../../domain/errors';

const SHARE_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedShare {
  shareId: string;
  token: string; // raw token — returned once, lives only in the share URL
  expiresAt: string;
}

export class ShareInvoiceService {
  constructor(
    private readonly invoices: IInvoiceRepository,
    private readonly shares: IInvoiceShareRepository,
    private readonly token: ISecureToken,
    private readonly encryption: IKmsEncryption,
  ) {}

  async createShare(userId: string, invoiceId: string): Promise<IssuedShare> {
    const invoice = await this.invoices.getDetail(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);

    const raw = this.token.generate();
    const tokenEnc = await this.encryption.encrypt(raw);
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * DAY_MS).toISOString();

    const shareId = await this.shares.create({
      invoiceId,
      createdByUserId: userId,
      tokenHash: this.token.hash(raw),
      tokenEnc,
      expiresAt,
    });

    return { shareId, token: raw, expiresAt };
  }

  async resolveShare(rawToken: string): Promise<ResolvedShare> {
    const resolved = await this.shares.resolve(this.token.hash(rawToken));
    if (!resolved) throw new InvalidShareError('token is invalid, revoked, or expired');
    return resolved;
  }
}
