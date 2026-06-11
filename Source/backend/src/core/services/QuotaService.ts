import type { IQuotaRepository, QuotaType } from '../ports/IQuotaRepository';

export class QuotaService {
  constructor(private readonly quotaRepo: IQuotaRepository) {}

  getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  async getUsed(tenantId: string, type: QuotaType, date: Date): Promise<number> {
    const weekStart = this.getWeekStart(date);
    return this.quotaRepo.getUsed(tenantId, type, weekStart);
  }
}
