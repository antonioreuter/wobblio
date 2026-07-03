import { describe, it, expect, vi } from 'vitest';
import { CloudWatchLogsClient, QueryStatus } from '@aws-sdk/client-cloudwatch-logs';
import { runInsightsQuery } from '@infrastructure/adapters/observability/cloudWatchLogsInsightsQuery';

function clientWith(send: ReturnType<typeof vi.fn>): CloudWatchLogsClient {
  return { send } as unknown as CloudWatchLogsClient;
}

describe('runInsightsQuery', () => {
  it('returns empty rows when the log group does not exist yet (worker never ran)', async () => {
    const notFound = Object.assign(new Error('log group does not exist'), { name: 'ResourceNotFoundException' });
    const send = vi.fn().mockRejectedValueOnce(notFound);

    const rows = await runInsightsQuery(clientWith(send), '/aws/lambda/never-run', 'fields @message', 0, 1, 5, 1);

    expect(rows).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1); // no polling after StartQuery fails
  });

  it('rethrows StartQuery errors that are not a missing log group', async () => {
    const denied = Object.assign(new Error('not authorized'), { name: 'AccessDeniedException' });
    const send = vi.fn().mockRejectedValueOnce(denied);

    await expect(
      runInsightsQuery(clientWith(send), '/aws/lambda/x', 'fields @message', 0, 1, 5, 1),
    ).rejects.toThrow('not authorized');
  });

  it('flattens completed query results into keyed rows', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ queryId: 'q-1' })
      .mockResolvedValueOnce({
        status: QueryStatus.Complete,
        results: [[{ field: 'stage', value: 'MERCHANT_RESOLUTION' }, { field: 'invocations', value: '3' }]],
      });

    const rows = await runInsightsQuery(clientWith(send), '/aws/lambda/x', 'fields @message', 0, 1, 5, 1);

    expect(rows).toEqual([{ stage: 'MERCHANT_RESOLUTION', invocations: '3' }]);
  });
});
