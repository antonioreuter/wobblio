export type QuotaType = 'UPLOADS' | 'HOUSEHOLD_UPLOADS';

export interface IQuotaRepository {
  getUsed(tenantId: string, type: QuotaType, weekStart: string): Promise<number>;
  increment(tenantId: string, type: QuotaType, weekStart: string): Promise<void>;
}
