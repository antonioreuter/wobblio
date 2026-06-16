import * as crypto from 'crypto';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
  KMSServiceException,
} from '@aws-sdk/client-kms';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { EncryptionError } from '@core/domain/errors';

interface EncryptionEnvelope {
  encryptedDataKey: string; // base64
  iv: string;               // base64
  ciphertext: string;       // base64
  authTag: string;          // base64
}

export class KmsEncryptionAdapter implements IKmsEncryption {
  private readonly client: KMSClient;

  constructor(
    private readonly keyId: string,
    region: string,
  ) {
    this.client = new KMSClient({ region });
  }

  async encrypt(plaintext: string): Promise<string> {
    try {
      const { CiphertextBlob, Plaintext } = await this.client.send(
        new GenerateDataKeyCommand({ KeyId: this.keyId, KeySpec: 'AES_256' }),
      );

      if (!CiphertextBlob || !Plaintext) {
        throw new EncryptionError('GenerateDataKey returned empty response');
      }

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(Plaintext), iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Zero out plaintext data key from memory
      Plaintext.fill(0);

      const envelope: EncryptionEnvelope = {
        encryptedDataKey: Buffer.from(CiphertextBlob).toString('base64'),
        iv: iv.toString('base64'),
        ciphertext: encrypted.toString('base64'),
        authTag: authTag.toString('base64'),
      };

      return Buffer.from(JSON.stringify(envelope)).toString('base64');
    } catch (err) {
      if (err instanceof EncryptionError) throw err;
      throw new EncryptionError('Encryption failed', err instanceof KMSServiceException ? err : undefined);
    }
  }

  async decrypt(ciphertext: string): Promise<string> {
    try {
      const envelope: EncryptionEnvelope = JSON.parse(
        Buffer.from(ciphertext, 'base64').toString('utf8'),
      );

      const { Plaintext } = await this.client.send(
        new DecryptCommand({
          KeyId: this.keyId,
          CiphertextBlob: Buffer.from(envelope.encryptedDataKey, 'base64'),
        }),
      );

      if (!Plaintext) {
        throw new EncryptionError('KMS Decrypt returned empty plaintext');
      }

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(Plaintext),
        Buffer.from(envelope.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]);

      Plaintext.fill(0);

      return decrypted.toString('utf8');
    } catch (err) {
      if (err instanceof EncryptionError) throw err;
      throw new EncryptionError('Decryption failed', err instanceof KMSServiceException ? err : undefined);
    }
  }
}
