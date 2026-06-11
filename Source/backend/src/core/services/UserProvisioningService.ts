import type { IAppUserRepository, UserStatus } from '../ports/IAppUserRepository';
import type { IFreeUserCounter } from '../ports/IFreeUserCounter';
import type { IWaitlistCapProvider } from '../ports/IWaitlistCapProvider';

export class UserProvisioningService {
  constructor(
    private readonly userRepo: IAppUserRepository,
    private readonly counter: IFreeUserCounter,
    private readonly capProvider: IWaitlistCapProvider,
  ) {}

  async provisionUser(cognitoSub: string, email: string): Promise<{ status: UserStatus }> {
    const cap = await this.capProvider.getMaxFreeUsersCap();
    const slotClaimed = await this.counter.tryClaimSlot(cap);
    const status: UserStatus = slotClaimed ? 'ACTIVE' : 'WAITLIST';
    await this.userRepo.insertUser(cognitoSub, email, status);
    return { status };
  }
}
