import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';

// Shared StartQuery→poll→row-flatten harness for Logs Insights adapters. `maxPolls` /
// `pollIntervalMs` are caller-supplied so each adapter can budget its own worst-case wait
// against the Lambda timeout of whatever handler invokes it.
export async function runInsightsQuery(
  client: CloudWatchLogsClient,
  logGroupName: string,
  queryString: string,
  startTime: number,
  endTime: number,
  maxPolls: number,
  pollIntervalMs: number,
): Promise<Array<Record<string, string>>> {
  let queryId: string | undefined;
  try {
    ({ queryId } = await client.send(
      new StartQueryCommand({ logGroupName, startTime, endTime, queryString }),
    ));
  } catch (err) {
    // A log group that has never been written to does not exist yet (e.g. a worker that
    // has not run since deploy). That is "no data", not a failure — return empty rows so
    // health panels render zeros instead of erroring the whole request.
    if (err instanceof Error && err.name === 'ResourceNotFoundException') return [];
    throw err;
  }
  if (!queryId) throw new Error('CloudWatch Logs StartQuery returned no queryId');

  for (let poll = 0; poll < maxPolls; poll++) {
    const response = await client.send(new GetQueryResultsCommand({ queryId }));
    if (response.status === QueryStatus.Complete) return (response.results ?? []).map(toRow);
    if (response.status === QueryStatus.Failed || response.status === QueryStatus.Cancelled) {
      throw new Error(`CloudWatch Logs query ${queryId} ${response.status}`);
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`CloudWatch Logs query ${queryId} did not complete in time`);
}

function toRow(fields: Array<{ field?: string; value?: string }>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const { field, value } of fields) {
    if (field && value !== undefined) row[field] = value;
  }
  return row;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
