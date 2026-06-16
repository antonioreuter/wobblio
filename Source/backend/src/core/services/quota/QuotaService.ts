import type { IQuotaRepository, QuotaType } from '../../ports/quota/IQuotaRepository';
import { QuotaExceededError } from '../../domain/errors';

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

  // Single enforcement point for upload quotas (invariant #6). The §2.4 cap is
  // resolved by the caller (role/household matrix) and passed in.
  async reserveUpload(tenantId: string, type: QuotaType, cap: number, now: Date): Promise<void> {
    const weekStart = this.getWeekStart(now);
    const used = await this.quotaRepo.getUsed(tenantId, type, weekStart);
    if (used >= cap) throw new QuotaExceededError(type, used, cap);
    await this.quotaRepo.increment(tenantId, type, weekStart);
  }
}
