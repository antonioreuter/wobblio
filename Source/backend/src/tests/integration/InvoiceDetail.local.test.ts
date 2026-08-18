import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool, type PoolClient } from 'pg';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';

// getDetail is assembled from shared SQL fragments (LIST_COLUMNS, which embeds
// PROCESSING_STAGE_COLUMN's reference to the `p` alias, and PROGRESS_JOIN which binds it).
// That coupling is invisible to the mocked unit suite: the ports are stubbed, so a query that
// references an unjoined alias only fails when Postgres parses it. It shipped exactly that way
// once — fix 07/01 added the stage column to LIST_COLUMNS and the join to the two list queries
// but not to getDetail, so every detail read 502'd with 42P01 and the drawer rendered
// "Couldn't load line items." for every receipt. These tests execute the real SQL.
//
// Requires the local stack migrated (`npm run migrate:up`).
const tenant = randomUUID();

describe('InvoiceRepositoryAdapter.getDetail — line items (Postgres)', () => {
  let pool: Pool;

  const seedInvoice = async (status: string): Promise<string> => {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, uploaded_by_user_id, image_s3_key, image_sha256, status,
          transaction_date, currency, total)
       VALUES ($1, $1, $2, $3, $4, DATE '2026-06-04', 'EUR', 33.43)
       RETURNING id`,
      [tenant, `receipts/${tenant}/${randomUUID()}.jpg`, randomUUID().replace(/-/g, '').padEnd(64, '0'), status],
    );
    return res.rows[0].id;
  };

  const seedLine = (invoiceId: string, lineIndex: number, rawText: string, lineTotal: number) =>
    pool.query(
      `INSERT INTO invoice_line (invoice_id, line_index, raw_text, quantity, line_total)
       VALUES ($1, $2, $3, 1, $4)`,
      [invoiceId, lineIndex, rawText, lineTotal],
    );

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });
    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status, home_currency)
       VALUES ($1, $2, 'invoice-detail@test.nl', 'ACTIVE', 'EUR')`,
      [tenant, `sub-${tenant}`],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM invoice_processing_progress WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM invoice_line WHERE invoice_id IN (SELECT id FROM invoice WHERE tenant_id = $1)`, [tenant]);
    await pool.query(`DELETE FROM invoice WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM app_user WHERE id = $1`, [tenant]);
    await pool.end();
  });

  const asTenant = async <T>(fn: (a: InvoiceRepositoryAdapter) => Promise<T>): Promise<T> => {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant]);
      return await fn(new InvoiceRepositoryAdapter(client));
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  };

  it('returns the parsed line items in receipt order', async () => {
    const invoiceId = await seedInvoice('PARSED');
    await seedLine(invoiceId, 1, 'AH VOLLE MELK 1L', 1.29);
    await seedLine(invoiceId, 0, 'AH BROOD BRUIN', 2.15);

    const detail = await asTenant((a) => a.getDetail(invoiceId));

    expect(detail).not.toBeNull();
    expect(detail!.lines.map((l) => l.rawText)).toEqual(['AH BROOD BRUIN', 'AH VOLLE MELK 1L']);
    expect(detail!.lines[0].lineTotal).toBeCloseTo(2.15, 2);
    // A terminal invoice has no stage left to render (PROCESSING_STAGE_COLUMN's implicit ELSE).
    expect(detail!.processingStage).toBeNull();
  });

  // The join the original bug omitted only carries a value on this path, so assert it directly:
  // a query that merely parses is not proof the stage is actually wired through.
  it('reports the in-flight processing stage from the progress row', async () => {
    const invoiceId = await seedInvoice('PROCESSING');
    await pool.query(
      `INSERT INTO invoice_processing_progress (invoice_id, tenant_id, stage) VALUES ($1, $2, 'MATCHING')`,
      [invoiceId, tenant],
    );

    const detail = await asTenant((a) => a.getDetail(invoiceId));

    expect(detail!.processingStage).toBe('MATCHING');
    expect(detail!.lines).toEqual([]);
  });

  it('falls back to RECEIVED when the worker has not written a stage yet', async () => {
    const invoiceId = await seedInvoice('PROCESSING');

    const detail = await asTenant((a) => a.getDetail(invoiceId));

    expect(detail!.processingStage).toBe('RECEIVED');
  });
});
