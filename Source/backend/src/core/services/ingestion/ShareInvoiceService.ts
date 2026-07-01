import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IInvoiceShareRepository, ResolvedShare } from '../../ports/ingestion/IInvoiceShareRepository';
import type { ISecureToken } from '../../ports/security/ISecureToken';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import { mintShareToken } from '../../domain/shareToken';
import { InvoiceNotFoundError, InvalidShareError } from '../../domain/errors';

const SHARE_TTL_DAYS = 7;

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

    const minted = await mintShareToken(this.token, this.encryption, SHARE_TTL_DAYS);
    const shareId = await this.shares.create({
      invoiceId,
      createdByUserId: userId,
      tokenHash: minted.tokenHash,
      tokenEnc: minted.tokenEnc,
      expiresAt: minted.expiresAt,
    });

    return { shareId, token: minted.token, expiresAt: minted.expiresAt };
  }

  async resolveShare(rawToken: string): Promise<ResolvedShare> {
    const resolved = await this.shares.resolve(this.token.hash(rawToken));
    if (!resolved) throw new InvalidShareError('token is invalid, revoked, or expired');
    return resolved;
  }
}
