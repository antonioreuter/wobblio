import type { Pool } from 'pg';
import type { IWaitlistStatusPort } from '@core/ports/IWaitlistStatusPort';

const WAITLIST_COUNT_KEY = 'waitlist_count';

export class WaitlistStatusDbAdapter implements IWaitlistStatusPort {
  constructor(
    private readonly pool: Pool,
    private readonly maxFreeUsers: number,
  ) {}

  async isWaitlistActive(): Promise<boolean> {
    const result = await this.pool.query<{ value: string }>(
      'SELECT value FROM system_counter WHERE name = $1',
      [WAITLIST_COUNT_KEY],
    );
    const count = parseInt(result.rows[0]?.value ?? '0', 10);
    return count >= this.maxFreeUsers;
  }
}
