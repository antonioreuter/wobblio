import * as crypto from 'crypto';
import type { ISecureToken } from '@core/ports/security/ISecureToken';

export class SecureTokenAdapter implements ISecureToken {
  generate(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
