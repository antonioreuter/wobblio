export interface TolerantFetchResult<T> {
  ref: T;
  bytes: Uint8Array;
}

// Fetches bytes for each ref via getBytes, tolerating individual failures (e.g. an object
// already past its S3 lifecycle expiry) so one missing item never fails the whole batch —
// shared by AdminDebugSampleService (capped, opaque naming) and ExportWorkerService
// (uncapped, invoiceId naming). Refs are processed in batches of `concurrency` at a time to
// bound peak in-flight fetches/memory; defaults to unbounded for small, pre-capped callers.
export async function fetchBytesTolerantly<T>(
  refs: T[],
  keyOf: (ref: T) => string,
  getBytes: (key: string) => Promise<Uint8Array>,
  concurrency: number = Infinity,
): Promise<TolerantFetchResult<T>[]> {
  const results: TolerantFetchResult<T>[] = [];
  for (let i = 0; i < refs.length; i += concurrency) {
    const batch = refs.slice(i, i + concurrency);
    const fetched = await Promise.allSettled(batch.map((ref) => getBytes(keyOf(ref))));
    batch.forEach((ref, j) => {
      const outcome = fetched[j];
      if (outcome.status === 'fulfilled') results.push({ ref, bytes: outcome.value });
    });
  }
  return results;
}
