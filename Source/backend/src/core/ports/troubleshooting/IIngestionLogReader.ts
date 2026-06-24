// Read-only access to the ingestion worker's CloudWatch log stream for operator
// triage on the admin Troubleshooting page. Returns structured pino lines, newest
// first, already filtered by level/time/text so the core never sees raw SDK shapes.
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface IngestionLogEvent {
  timestamp: string; // ISO-8601
  level: LogLevel;
  message: string;
  requestId: string | null;
  raw: string; // full JSON @message, for the inspect/expand view
}

export interface LogQueryOptions {
  minutes: number; // lookback window
  minLevel: LogLevel; // floor: 'error' shows only errors, 'info' shows info+warn+error, …
  search: string | null; // free-text / id substring match
  limit: number;
}

export interface IIngestionLogReader {
  query(options: LogQueryOptions): Promise<IngestionLogEvent[]>;
}
