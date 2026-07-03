import { describe, it, expect, vi, afterEach } from 'vitest';
import { CloudWatchLogsClient, QueryStatus, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchLogsAgenticStageHealthAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsAgenticStageHealthAdapter';

type Row = Array<{ field: string; value: string }>;

// The adapter builds its own CloudWatchLogsClient, so intercept send on the prototype. The
// last-failure query's aggregate outputs are aliased with `last*` prefixes so they don't collide
// with the `invoiceId`/`error` source fields (a collision makes Logs Insights reject the whole
// query as a dependency cycle). This test locks in that the reader consumes those alias names.
function stubSend(aggregate: Row[], failure: Row[]) {
  return vi.spyOn(CloudWatchLogsClient.prototype, 'send').mockImplementation((command: unknown) => {
    if (command instanceof StartQueryCommand) {
      const isFailure = String(command.input.queryString).includes('latest(@timestamp)');
      return Promise.resolve({ queryId: isFailure ? 'q-fail' : 'q-agg' }) as never;
    }
    const queryId = (command as { input: { queryId: string } }).input.queryId;
    return Promise.resolve({ status: QueryStatus.Complete, results: queryId === 'q-fail' ? failure : aggregate }) as never;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('CloudWatchLogsAgenticStageHealthAdapter', () => {
  it('maps de-collided last* alias fields into the last-failure shape', async () => {
    stubSend(
      [[
        { field: 'stage', value: 'MERCHANT_RESOLUTION' },
        { field: 'invocations', value: '5' },
        { field: 'failures', value: '1' },
        { field: 'avgMs', value: '120' },
      ]],
      [[
        { field: 'stage', value: 'MERCHANT_RESOLUTION' },
        { field: 'lastFailureAt', value: '2026-07-03 13:00:00.000' },
        { field: 'lastInvoiceId', value: 'inv-42' },
        { field: 'lastError', value: 'boom' },
      ]],
    );
    const adapter = new CloudWatchLogsAgenticStageHealthAdapter('eu-west-1', '/aws/lambda/x');

    const [health] = await adapter.getStageHealth(60);

    expect(health).toEqual({
      stage: 'MERCHANT_RESOLUTION',
      invocations: 5,
      failures: 1,
      avgDurationMs: 120,
      lastFailure: { invoiceId: 'inv-42', message: 'boom', timestamp: '2026-07-03T13:00:00.000Z' },
    });
  });
});
