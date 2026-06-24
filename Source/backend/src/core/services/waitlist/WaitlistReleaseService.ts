import type { IFreeUserCounter } from '../../ports/waitlist/IFreeUserCounter';
import type { IWaitlistCapProvider } from '../../ports/waitlist/IWaitlistCapProvider';
import type { IWaitlistRepository, WaitlistUser } from '../../ports/waitlist/IWaitlistRepository';
import type { IEmailSender } from '../../ports/notifications/IEmailSender';

export interface ReleaseResult {
  released: number;
}

export class WaitlistReleaseService {
  constructor(
    private readonly counter: IFreeUserCounter,
    private readonly capProvider: IWaitlistCapProvider,
    private readonly waitlistRepo: IWaitlistRepository,
    private readonly emailSender: IEmailSender,
  ) {}

  // maxToRelease bounds a manual operator release (admin waitlist panel) to N users;
  // the FIFO cron passes nothing and releases the full cap headroom as before.
  async releaseEligibleUsers(maxToRelease?: number): Promise<ReleaseResult> {
    const cap = await this.capProvider.getMaxFreeUsersCap();
    const current = await this.counter.getCurrentCount();
    const headroom = Math.max(0, cap - current);
    const available = maxToRelease === undefined ? headroom : Math.min(headroom, maxToRelease);

    if (available === 0) return { released: 0 };

    const batch = await this.waitlistRepo.getWaitlistedBatch(available);
    if (batch.length === 0) return { released: 0 };

    const claimedUsers: WaitlistUser[] = [];
    for (const user of batch) {
      const claimed = await this.counter.tryClaimSlot(cap);
      if (!claimed) break;
      claimedUsers.push(user);
    }

    if (claimedUsers.length === 0) return { released: 0 };

    const activated = await this.waitlistRepo.activateUsers(claimedUsers.map(u => u.id));

    for (const user of claimedUsers.slice(0, activated)) {
      await this.emailSender.sendWaitlistRelease(user.email);
    }

    return { released: activated };
  }
}
