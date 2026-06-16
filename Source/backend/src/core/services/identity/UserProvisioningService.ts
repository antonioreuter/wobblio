import type { IAppUserRepository, UserStatus, UserProfile } from '../../ports/identity/IAppUserRepository';
import type { IFreeUserCounter } from '../../ports/waitlist/IFreeUserCounter';
import type { IWaitlistCapProvider } from '../../ports/waitlist/IWaitlistCapProvider';

export class UserProvisioningService {
  constructor(
    private readonly userRepo: IAppUserRepository,
    private readonly counter: IFreeUserCounter,
    private readonly capProvider: IWaitlistCapProvider,
  ) {}

  async provisionUser(
    cognitoSub: string,
    email: string,
    profile?: UserProfile,
  ): Promise<{ status: UserStatus }> {
    const cap = await this.capProvider.getMaxFreeUsersCap();
    const slotClaimed = await this.counter.tryClaimSlot(cap);
    const status: UserStatus = slotClaimed ? 'ACTIVE' : 'WAITLIST';
    await this.userRepo.insertUser(cognitoSub, email, status, profile);
    return { status };
  }
}
