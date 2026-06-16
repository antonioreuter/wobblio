import type { Pool } from 'pg';
import type { IWaitlistStatusPort } from '@core/ports/waitlist/IWaitlistStatusPort';

const FREE_USER_COUNT_KEY = 'free_user_count';

export class WaitlistStatusDbAdapter implements IWaitlistStatusPort {
  constructor(
    private readonly pool: Pool,
    private readonly maxFreeUsers: number,
  ) {}

  async isWaitlistActive(): Promise<boolean> {
    const result = await this.pool.query<{ value: string }>(
      'SELECT value FROM system_counter WHERE name = $1',
      [FREE_USER_COUNT_KEY],
    );
    const freeUserCount = parseInt(result.rows[0]?.value ?? '0', 10);
    return freeUserCount >= this.maxFreeUsers;
  }
}
