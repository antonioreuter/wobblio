import type { UserRole } from '@core/ports/identity/IAppUserRepository';

export interface IUploadQuotaProvider {
  // Weekly credit caps (1 credit = 1 LLM token): invoice limit × average tokens per
  // invoice. -1 invoice limits surface as Infinity (unlimited).
  getPersonalUploadsCap(role: UserRole): Promise<number>;
  getHouseholdUploadsCap(): Promise<number>;
  // Average tokens per invoice — the per-invoice credit weight. Backs both the cap
  // derivation and the presign burst projection (in-flight uploads × this).
  getAverageTokensPerInvoice(): Promise<number>;
}
