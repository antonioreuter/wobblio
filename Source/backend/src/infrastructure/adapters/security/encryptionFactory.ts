import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { KmsEncryptionAdapter } from './KmsEncryptionAdapter';
import { LocalEncryptionAdapter } from './LocalEncryptionAdapter';

const DEFAULT_LOCAL_SECRET = 'wobblio-local-dev-secret';

// Local dev encrypts with a dev key (no AWS); AWS stages use KMS envelope
// encryption. Same IKmsEncryption port, so callers are identical everywhere.
export function buildKmsEncryption(region: string): IKmsEncryption {
  if (process.env.STAGE === 'local') {
    return new LocalEncryptionAdapter(process.env.LOCAL_ENC_SECRET ?? DEFAULT_LOCAL_SECRET);
  }
  return new KmsEncryptionAdapter(process.env.KMS_KEY_ARN!, region);
}
