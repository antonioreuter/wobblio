import type { IDataRequestRepository } from '../../ports/gdpr/IDataRequestRepository';
import type { IExportQueue } from '../../ports/gdpr/IExportQueue';
import { ExportRateLimitedError } from '../../domain/errors';

const RATE_LIMIT_WINDOW_HOURS = 24;

export class RequestExportService {
  constructor(
    private readonly requests: IDataRequestRepository,
    private readonly queue: IExportQueue,
  ) {}

  // FAILED requests don't count toward the window (§14 decision) — a crashed export worker
  // must not lock the tenant out of retrying the same day.
  async request(tenantId: string): Promise<{ requestId: string }> {
    // Serializes concurrent requests for the same tenant (e.g. a double-click or client retry)
    // so the check-then-insert below can't race two callers both past hasRecentExportRequest
    // before either commits its createExportRequest.
    await this.requests.acquireExportLock(tenantId);

    if (await this.requests.hasRecentExportRequest(tenantId, RATE_LIMIT_WINDOW_HOURS)) {
      throw new ExportRateLimitedError();
    }

    const requestId = await this.requests.createExportRequest(tenantId);
    await this.queue.enqueue({ requestId, tenantId });
    return { requestId };
  }
}
