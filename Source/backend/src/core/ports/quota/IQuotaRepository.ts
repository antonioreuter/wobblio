export type QuotaType = 'UPLOADS' | 'HOUSEHOLD_UPLOADS' | 'UPLOAD_FAILURE_REFUNDS';

export interface IQuotaRepository {
  getUsed(tenantId: string, type: QuotaType, weekStart: string): Promise<number>;
  increment(tenantId: string, type: QuotaType, weekStart: string): Promise<void>;
  decrement(tenantId: string, type: QuotaType, weekStart: string): Promise<void>;
}
