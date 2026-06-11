import type { Pool } from 'pg';
import type { IFreeUserCounter } from '@core/ports/IFreeUserCounter';

const COUNTER_NAME = 'free_user_count';

export class FreeUserCounterAdapter implements IFreeUserCounter {
  constructor(private readonly pool: Pool) {}

  async tryClaimSlot(cap: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE system_counter
       SET value = value + 1
       WHERE name = $1 AND value < $2
       RETURNING value`,
      [COUNTER_NAME, cap],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getCurrentCount(): Promise<number> {
    const result = await this.pool.query<{ value: string }>(
      'SELECT value FROM system_counter WHERE name = $1',
      [COUNTER_NAME],
    );
    return parseInt(result.rows[0]?.value ?? '0', 10);
  }
}
