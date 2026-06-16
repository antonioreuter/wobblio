import type { UserRole } from '@core/ports/identity/IAppUserRepository';

export interface IUploadQuotaProvider {
  getPersonalUploadsCap(role: UserRole): Promise<number>;
  getHouseholdUploadsCap(): Promise<number>;
}
