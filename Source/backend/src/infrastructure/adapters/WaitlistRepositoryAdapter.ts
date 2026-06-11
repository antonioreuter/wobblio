import type { Pool } from 'pg';
import type { IWaitlistRepository, WaitlistUser } from '@core/ports/IWaitlistRepository';

const WAITLIST_COUNTER = 'waitlist_count';

export class WaitlistRepositoryAdapter implements IWaitlistRepository {
  constructor(private readonly pool: Pool) {}

  async getWaitlistedBatch(limit: number): Promise<WaitlistUser[]> {
    const result = await this.pool.query<WaitlistUser>(
      'SELECT * FROM get_waitlisted_batch($1)',
      [limit],
    );
    return result.rows;
  }

  async activateUsers(userIds: string[]): Promise<number> {
    const result = await this.pool.query<{ release_waitlisted_users: string }>(
      'SELECT release_waitlisted_users($1::uuid[])',
      [userIds],
    );
    return parseInt(result.rows[0]?.release_waitlisted_users ?? '0', 10);
  }

  async getWaitlistCount(): Promise<number> {
    const result = await this.pool.query<{ value: string }>(
      'SELECT value FROM system_counter WHERE name = $1',
      [WAITLIST_COUNTER],
    );
    return parseInt(result.rows[0]?.value ?? '0', 10);
  }
}
