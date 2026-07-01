import type { ISecureToken } from '../ports/security/ISecureToken';
import type { IKmsEncryption } from '../ports/security/IKmsEncryption';

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface MintedShareToken {
  token: string; // raw token — returned once, never stored in the clear
  tokenHash: string;
  tokenEnc: string;
  expiresAt: string; // ISO 8601
}

// Shared token-issuance math for every "public weblink" share/invite feature
// (household invites, invoice shares, shopping-list shares): generate a raw
// token, hash it for at-rest lookup, KMS-envelope-encrypt it for at-rest
// recovery, and compute its expiry. Each caller still owns its own
// entity-specific `repo.create(...)` call and error types.
export async function mintShareToken(
  token: ISecureToken,
  encryption: IKmsEncryption,
  ttlDays: number,
): Promise<MintedShareToken> {
  const raw = token.generate();
  const tokenEnc = await encryption.encrypt(raw);
  const expiresAt = new Date(Date.now() + ttlDays * DAY_MS).toISOString();
  return { token: raw, tokenHash: token.hash(raw), tokenEnc, expiresAt };
}
