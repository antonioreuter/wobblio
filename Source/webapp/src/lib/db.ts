import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  }
  return pool;
}

export async function getFreeUserCount(): Promise<number> {
  const result = await getPool().query<{ value: string }>(
    "SELECT value FROM system_counter WHERE name = 'waitlist_count'",
  );
  return parseInt(result.rows[0]?.value ?? '0', 10);
}
