import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { DlqAdminService } from '@core/services/admin/DlqAdminService';
import type { IDeadLetterQueue } from '@core/ports/ingestion/IDeadLetterQueue';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };

describe('DlqAdminService', () => {
  let queue: MockedObject<IDeadLetterQueue>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: DlqAdminService;

  beforeEach(() => {
    queue = {
      list: vi.fn(),
      get: vi.fn(),
      replay: vi.fn(),
      remove: vi.fn(),
      replayAll: vi.fn(),
      deleteAll: vi.fn(),
    };
    audit = { record: vi.fn() };
    sut = new DlqAdminService(queue, audit);
  });

  it('lists without auditing (reads never audit)', async () => {
    queue.list.mockResolvedValue([]);
    await sut.list(10);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('get delegates to the queue without auditing', async () => {
    queue.get.mockResolvedValue(null);
    await sut.get('msg-x');
    expect(queue.get).toHaveBeenCalledWith('msg-x');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deleteAll bounds the limit and audits the affected count', async () => {
    queue.deleteAll.mockResolvedValue(10);
    const count = await sut.deleteAll(ACTOR, 50);
    expect(count).toBe(10);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dlq.delete', target: 'all:10' }),
    );
  });

  it('replays a message and audits dlq.replay with the message id', async () => {
    queue.replay.mockResolvedValue(true);

    const replayed = await sut.replay(ACTOR, 'msg-1', 'handle-1', '{"invoiceId":"inv-1"}');

    expect(replayed).toBe(true);
    expect(queue.replay).toHaveBeenCalledWith('msg-1', 'handle-1', '{"invoiceId":"inv-1"}');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dlq.replay', target: 'msg-1' }),
    );
  });

  it('deletes a message and audits dlq.delete', async () => {
    queue.remove.mockResolvedValue(true);
    await sut.remove(ACTOR, 'msg-2', 'handle-2');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dlq.delete', target: 'msg-2' }),
    );
  });

  it('bounds replay-all to the safety max and audits the affected count', async () => {
    queue.replayAll.mockResolvedValue(500);
    const count = await sut.replayAll(ACTOR, 99999);
    expect(queue.replayAll).toHaveBeenCalledWith(500);
    expect(count).toBe(500);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dlq.replay', target: 'all:500' }),
    );
  });

  it('rejects a non-positive bulk limit', async () => {
    await expect(sut.deleteAll(ACTOR, 0)).rejects.toBeInstanceOf(InvalidAdminInputError);
    expect(queue.deleteAll).not.toHaveBeenCalled();
  });
});
