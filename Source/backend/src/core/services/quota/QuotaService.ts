import type { IQuotaRepository, QuotaType } from '../../ports/quota/IQuotaRepository';
import { weekStart } from '../../domain/week';

export class QuotaService {
  constructor(private readonly quotaRepo: IQuotaRepository) {}

  getWeekStart(date: Date): string {
    return weekStart(date.toISOString().slice(0, 10));
  }

  async getUsed(tenantId: string, type: QuotaType, date: Date): Promise<number> {
    const weekStart = this.getWeekStart(date);
    return this.quotaRepo.getUsed(tenantId, type, weekStart);
  }

  // Read-only Soft-Cap check (§2.1): the upload is permitted while used credits stay
  // strictly under the cap. Presign passes a pessimistic `inFlightCredits` projection
  // (in-flight uploads × avg tokens) so a burst can't all pass before any charge lands.
  // No write — charging happens at worker success-time.
  async checkAvailability(
    tenantId: string,
    type: QuotaType,
    cap: number,
    now: Date,
    inFlightCredits = 0,
  ): Promise<boolean> {
    if (cap === Number.POSITIVE_INFINITY) return true;
    const used = await this.quotaRepo.getUsed(tenantId, type, this.getWeekStart(now));
    return used + inFlightCredits < cap;
  }

  // Worker post-success charge: add the actual tokens consumed to the weekly counter
  // (invariant #6, single write point). Runs inside the committed tenant transaction.
  async charge(tenantId: string, type: QuotaType, weekStart: string, amount: number): Promise<void> {
    await this.quotaRepo.increment(tenantId, type, weekStart, amount);
  }
}
