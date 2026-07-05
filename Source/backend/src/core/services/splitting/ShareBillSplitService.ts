import type { IBillSplitRepository } from '../../ports/splitting/IBillSplitRepository';
import type { IBillSplitShareRepository, ResolvedBillSplitShare } from '../../ports/splitting/IBillSplitShareRepository';
import type { ISecureToken } from '../../ports/security/ISecureToken';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import { mintShareToken } from '../../domain/shareToken';
import { BillSplitNotFoundError, InvalidShareError } from '../../domain/errors';

const SHARE_TTL_DAYS = 7;

export interface IssuedShare {
  shareId: string;
  token: string; // raw token — returned once, lives only in the share URL
  expiresAt: string;
}

// Public read-only sharing of a bill split (§11). Mirrors ShareInvoiceService: an
// unguessable /s/<token> link, 7-day expiry, token hashed for lookup + KMS-encrypted
// at rest. The split id is never exposed.
export class ShareBillSplitService {
  constructor(
    private readonly splits: IBillSplitRepository,
    private readonly shares: IBillSplitShareRepository,
    private readonly token: ISecureToken,
    private readonly encryption: IKmsEncryption,
  ) {}

  async createShare(userId: string, splitId: string): Promise<IssuedShare> {
    const meta = await this.splits.getMeta(splitId);
    if (!meta) throw new BillSplitNotFoundError(splitId);

    const minted = await mintShareToken(this.token, this.encryption, SHARE_TTL_DAYS);
    const shareId = await this.shares.create({
      splitId,
      createdByUserId: userId,
      tokenHash: minted.tokenHash,
      tokenEnc: minted.tokenEnc,
      expiresAt: minted.expiresAt,
    });

    return { shareId, token: minted.token, expiresAt: minted.expiresAt };
  }

  async resolveShare(rawToken: string): Promise<ResolvedBillSplitShare> {
    const resolved = await this.shares.resolve(this.token.hash(rawToken));
    if (!resolved) throw new InvalidShareError('token is invalid, revoked, or expired');
    return resolved;
  }
}
