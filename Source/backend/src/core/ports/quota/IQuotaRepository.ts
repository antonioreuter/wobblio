export type QuotaType = 'CREDITS' | 'HOUSEHOLD_CREDITS';

export interface IQuotaRepository {
  getUsed(tenantId: string, type: QuotaType, weekStart: string): Promise<number>;
  increment(tenantId: string, type: QuotaType, weekStart: string, amount: number): Promise<void>;
  decrement(tenantId: string, type: QuotaType, weekStart: string, amount: number): Promise<void>;
}
