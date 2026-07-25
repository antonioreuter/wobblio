import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool } from 'pg';
import { ProcessingProgressAdapter } from '@infrastructure/adapters/ingestion/ProcessingProgressAdapter';

describe('ProcessingProgressAdapter', () => {
  let query: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let connect: ReturnType<typeof vi.fn>;
  let adapter: ProcessingProgressAdapter;

  const statements = () => query.mock.calls.map((c) => String(c[0]));

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rowCount: 1 });
    release = vi.fn();
    connect = vi.fn().mockResolvedValue({ query, release });
    adapter = new ProcessingProgressAdapter({ connect } as unknown as Pool);
  });

  it('writes the stage in its own committed transaction on its own connection', async () => {
    await adapter.recordStage('inv-1', 'tenant-1', 'READING');

    // Its own connection, not the pipeline's: a stage written on the worker's long transaction
    // would not be visible to a polling client until COMMIT, which is when it stops mattering.
    expect(connect).toHaveBeenCalledTimes(1);
    expect(statements()[0]).toBe('BEGIN');
    expect(statements().at(-1)).toBe('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('sets the RLS tenant context before touching the table', async () => {
    await adapter.recordStage('inv-1', 'tenant-1', 'MATCHING');

    const setConfigIndex = statements().findIndex((s) => s.includes('set_config'));
    const insertIndex = statements().findIndex((s) => s.includes('invoice_processing_progress'));
    expect(setConfigIndex).toBeGreaterThan(-1);
    expect(setConfigIndex).toBeLessThan(insertIndex);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('set_config'), ['tenant-1']);
  });

  it('upserts so a redelivered or re-entered stage overwrites rather than conflicting', async () => {
    await adapter.recordStage('inv-1', 'tenant-1', 'FINALIZING');

    const insert = statements().find((s) => s.includes('invoice_processing_progress'))!;
    expect(insert).toContain('ON CONFLICT (invoice_id) DO UPDATE');
    expect(insert).toContain('updated_at = now()');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), ['inv-1', 'tenant-1', 'FINALIZING']);
  });

  it('never throws when the write fails, and rolls back and releases the connection', async () => {
    query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('INSERT INTO')) throw new Error('deadlock detected');
      return { rowCount: 1 };
    });

    await expect(adapter.recordStage('inv-1', 'tenant-1', 'READING')).resolves.toBeUndefined();

    expect(statements()).toContain('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('never throws when the connection itself cannot be acquired', async () => {
    connect.mockRejectedValue(new Error('timeout exceeded when trying to connect'));

    await expect(adapter.recordStage('inv-1', 'tenant-1', 'READING')).resolves.toBeUndefined();

    expect(release).not.toHaveBeenCalled();
  });

  it('releases the connection even when the rollback also fails', async () => {
    query.mockImplementation(async (sql: string) => {
      if (String(sql) === 'BEGIN') return { rowCount: 0 };
      throw new Error('connection terminated');
    });

    await expect(adapter.recordStage('inv-1', 'tenant-1', 'MATCHING')).resolves.toBeUndefined();

    expect(release).toHaveBeenCalledTimes(1);
  });
});
