import type { IFreeUserCounter } from '@core/ports/waitlist/IFreeUserCounter';
import type { IWaitlistCapProvider } from '@core/ports/waitlist/IWaitlistCapProvider';
import type { IWaitlistRepository } from '@core/ports/waitlist/IWaitlistRepository';
import type { WaitlistReleaseService } from '@core/services/waitlist/WaitlistReleaseService';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError } from '@core/domain/errors';

export interface WaitlistOverview {
  freeUsers: number;
  cap: number;
  queueSize: number;
}

// Upper bound on a single manual release — a guard against a fat-fingered operator
// flooding the active pool in one click. The cap headroom bounds it further down.
const MAX_RELEASE_BATCH = 1000;

export class AdminWaitlistService {
  constructor(
    private readonly counter: IFreeUserCounter,
    private readonly capProvider: IWaitlistCapProvider,
    private readonly waitlistRepo: IWaitlistRepository,
    private readonly releaseService: WaitlistReleaseService,
    private readonly audit: IAdminAuditLog,
  ) {}

  async getOverview(): Promise<WaitlistOverview> {
    const [freeUsers, cap, queueSize] = await Promise.all([
      this.counter.getCurrentCount(),
      this.capProvider.getMaxFreeUsersCap(),
      this.waitlistRepo.getWaitlistCount(),
    ]);
    return { freeUsers, cap, queueSize };
  }

  async release(actor: AdminActor, count: number): Promise<number> {
    if (!Number.isInteger(count) || count < 1 || count > MAX_RELEASE_BATCH) {
      throw new InvalidAdminInputError(`count must be an integer between 1 and ${MAX_RELEASE_BATCH}`);
    }

    const { released } = await this.releaseService.releaseEligibleUsers(count);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'waitlist.release',
      target: String(released),
      after: { requested: count, released },
    });
    return released;
  }
}
