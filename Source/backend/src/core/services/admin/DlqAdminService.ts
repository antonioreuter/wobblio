import type { IDeadLetterQueue, DlqMessage } from '@core/ports/ingestion/IDeadLetterQueue';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError } from '@core/domain/errors';

const MAX_BULK = 500; // safety bound on replay-all / delete-all

export class DlqAdminService {
  constructor(
    private readonly queue: IDeadLetterQueue,
    private readonly audit: IAdminAuditLog,
  ) {}

  list(limit: number): Promise<DlqMessage[]> {
    return this.queue.list(boundLimit(limit, 10));
  }

  get(messageId: string): Promise<DlqMessage | null> {
    return this.queue.get(messageId);
  }

  async replay(actor: AdminActor, messageId: string, receiptHandle: string, body: string): Promise<boolean> {
    const replayed = await this.queue.replay(messageId, receiptHandle, body);
    await this.record(actor, 'dlq.replay', messageId);
    return replayed;
  }

  async remove(actor: AdminActor, messageId: string, receiptHandle: string): Promise<boolean> {
    const removed = await this.queue.remove(messageId, receiptHandle);
    await this.record(actor, 'dlq.delete', messageId);
    return removed;
  }

  async replayAll(actor: AdminActor, limit: number): Promise<number> {
    const count = await this.queue.replayAll(boundLimit(limit, MAX_BULK));
    await this.record(actor, 'dlq.replay', `all:${count}`);
    return count;
  }

  async deleteAll(actor: AdminActor, limit: number): Promise<number> {
    const count = await this.queue.deleteAll(boundLimit(limit, MAX_BULK));
    await this.record(actor, 'dlq.delete', `all:${count}`);
    return count;
  }

  private record(actor: AdminActor, action: 'dlq.replay' | 'dlq.delete', target: string): Promise<void> {
    return this.audit.record({ actorUserId: actor.id, actorEmail: actor.email, action, target });
  }
}

function boundLimit(limit: number, max: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidAdminInputError(`limit must be a positive integer (max ${max})`);
  }
  return Math.min(limit, max);
}
