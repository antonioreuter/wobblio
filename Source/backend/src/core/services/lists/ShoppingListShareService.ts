import type { IShoppingListRepository } from '../../ports/lists/IShoppingListRepository';
import type { IShoppingListShareRepository, ResolvedListShare } from '../../ports/lists/IShoppingListShareRepository';
import type { ISecureToken } from '../../ports/security/ISecureToken';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import { mintShareToken } from '../../domain/shareToken';
import { ListNotFoundError, InvalidListShareError } from '../../domain/errors';

const SHARE_TTL_DAYS = 7;

export interface IssuedListShare {
  shareId: string;
  token: string; // raw token — returned once, lives only in the share URL
  expiresAt: string;
}

// Public weblink sharing for a shopping list (§10b, Premium and Standard alike).
// Modeled directly on ShareInvoiceService — the token is the only credential.
export class ShoppingListShareService {
  constructor(
    private readonly lists: IShoppingListRepository,
    private readonly shares: IShoppingListShareRepository,
    private readonly token: ISecureToken,
    private readonly encryption: IKmsEncryption,
  ) {}

  async createShare(userId: string, listId: string): Promise<IssuedListShare> {
    const list = await this.lists.getDetail(listId);
    if (!list) throw new ListNotFoundError(listId);

    const minted = await mintShareToken(this.token, this.encryption, SHARE_TTL_DAYS);
    const shareId = await this.shares.create({
      listId,
      createdByUserId: userId,
      tokenHash: minted.tokenHash,
      tokenEnc: minted.tokenEnc,
      expiresAt: minted.expiresAt,
    });

    return { shareId, token: minted.token, expiresAt: minted.expiresAt };
  }

  async revokeShare(listId: string, shareId: string): Promise<void> {
    const revoked = await this.shares.revoke(listId, shareId);
    if (!revoked) throw new InvalidListShareError('share not found or already revoked');
  }

  async resolveShare(rawToken: string): Promise<ResolvedListShare> {
    const resolved = await this.shares.resolve(this.token.hash(rawToken));
    if (!resolved) throw new InvalidListShareError('token is invalid, revoked, or expired');
    return resolved;
  }
}
