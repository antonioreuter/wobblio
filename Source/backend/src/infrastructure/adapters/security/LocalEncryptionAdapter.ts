import * as crypto from 'crypto';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { EncryptionError } from '@core/domain/errors';

interface LocalEnvelope {
  iv: string;
  ciphertext: string;
  authTag: string;
}

// Local-only stand-in for the KMS envelope adapter: AES-256-GCM under a key
// derived from a dev secret. Same IKmsEncryption contract, no AWS dependency.
// AWS stages use KmsEncryptionAdapter (see encryptionFactory).
export class LocalEncryptionAdapter implements IKmsEncryption {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const envelope: LocalEnvelope = {
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
    return Buffer.from(JSON.stringify(envelope)).toString('base64');
  }

  async decrypt(ciphertext: string): Promise<string> {
    try {
      const envelope: LocalEnvelope = JSON.parse(Buffer.from(ciphertext, 'base64').toString('utf8'));
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err) {
      throw new EncryptionError('Local decryption failed', err);
    }
  }
}
