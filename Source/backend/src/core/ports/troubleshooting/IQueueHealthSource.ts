// Point-in-time depth of the ingestion queue and its dead-letter queue, for the
// Troubleshooting page's health row. Approximate by nature (SQS attributes).
export interface QueueHealth {
  queueDepth: number; // visible messages on the main ingestion queue
  inFlight: number; // received-but-not-deleted (being processed)
  dlqDepth: number; // messages parked in the DLQ
}

export interface IQueueHealthSource {
  getHealth(): Promise<QueueHealth>;
}
