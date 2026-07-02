// Shared with the backend's IQueueHealthSource port (Source/backend/src/core/ports/troubleshooting/IQueueHealthSource.ts).
export interface QueueHealth {
  queueDepth: number
  inFlight: number
  dlqDepth: number
}
