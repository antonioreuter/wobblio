import { Client } from 'pg';
import { buildDbClient, seedPostgres } from './seed';

// Tables kept across a reset. Everything else in schema `public` is truncated, so a new
// migration's table is wiped by default (allowlist, not blocklist). Rationale per table is
// in the plan: app_user (users → external Cognito identities), pgmigrations (migration
// ledger), limits + system_counter (migration-seeded config the reseed can't restore),
// fx_rate (external reference), payment_transaction (7-year retention, invariant #11).
export const PRESERVE_TABLES = [
  'app_user',
  'pgmigrations',
  'limits',
  'system_counter',
  'fx_rate',
  'payment_transaction',
] as const;

// Dev/local only. Prod's database is `wobblio` (no dev/local marker) and is refused here;
// the typed CONFIRM_RESET check below is the second, primary guard.
export function isResettableDatabase(dbName: string): boolean {
  return /(?:^|[_-])(?:dev|local)(?:[_-]|$)/i.test(dbName);
}

// Truncate everything in `public` except the preserve allowlist (sorted for stable output).
export function computeTruncateList(allTables: string[], preserve: readonly string[]): string[] {
  const preserved = new Set(preserve);
  return allTables.filter((t) => !preserved.has(t)).sort();
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

async function rowCounts(client: Client, tables: readonly string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tables) {
    const res = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${quoteIdent(t)}`).catch(() => null);
    out[t] = res ? res.rows[0].n : -1; // -1 => table absent
  }
  return out;
}

async function main(): Promise<void> {
  const client = buildDbClient();
  await client.connect();
  try {
    const target = (await client.query<{ db: string; usr: string }>(
      'SELECT current_database() AS db, current_user AS usr',
    )).rows[0];
    const { db, usr } = target;

    // Layered prod guards — fail closed.
    if (process.env.STAGE === 'prod') throw new Error('STAGE=prod is forbidden for a database reset');
    if (!isResettableDatabase(db)) {
      throw new Error(`Database "${db}" is not a dev/local database — refusing to reset (prod is never resettable).`);
    }

    const allTables = (await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    )).rows.map((r) => r.tablename);
    const toTruncate = computeTruncateList(allTables, PRESERVE_TABLES);

    console.log(`\nTarget:   ${usr}@${db}`);
    console.log(`Preserve (${PRESERVE_TABLES.length}): ${[...PRESERVE_TABLES].sort().join(', ')}`);
    console.log(`Truncate (${toTruncate.length}): ${toTruncate.join(', ') || '(none)'}`);

    // Dry-run unless the operator types the exact db name — guards against accidental runs.
    if (process.env.CONFIRM_RESET !== db) {
      console.log(`\nDRY RUN — nothing changed. To execute: CONFIRM_RESET=${db} npm run reset:dev\n`);
      return;
    }
    if (toTruncate.length === 0) {
      console.log('\nNothing to truncate. Done.\n');
      return;
    }

    const before = await rowCounts(client, PRESERVE_TABLES);

    // One multi-table TRUNCATE resolves FK order; CASCADE is a safety net and cannot reach a
    // preserved table (none FK into the truncated set; app_user has no outbound FK).
    await client.query('BEGIN');
    await client.query(`TRUNCATE TABLE ${toTruncate.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE`);
    await client.query('COMMIT');
    console.log(`\nTruncated ${toTruncate.length} tables.`);

    // Re-seed the global reference + catalog tables (idempotent; reference → taxonomy → merchants).
    await seedPostgres(client);

    const after = await rowCounts(client, PRESERVE_TABLES);
    console.log('Preserved tables (rows before → after):');
    for (const t of PRESERVE_TABLES) console.log(`  ${t}: ${before[t]} → ${after[t]}`);
    console.log('\nReset complete.\n');
  } finally {
    await client.end();
  }
}

// Only run as a CLI; importing the pure helpers for tests must not trigger a reset.
if (require.main === module) {
  main().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
}
