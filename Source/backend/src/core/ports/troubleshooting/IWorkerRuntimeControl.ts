import type { LogLevel } from './IIngestionLogReader';

// Live control of the ingestion worker's log level via its Lambda environment.
// `configuredLevel` is what the env var holds; `effectiveLevel` accounts for an
// elapsed auto-revert deadline (mirrors the worker's own resolveLogLevel).
export interface LogLevelState {
  configuredLevel: LogLevel;
  effectiveLevel: LogLevel;
  expiresAt: string | null; // ISO-8601 auto-revert deadline, null when permanent/default
}

export interface IWorkerRuntimeControl {
  getLogLevel(): Promise<LogLevelState>;
  setLogLevel(level: LogLevel, expiresAt: Date | null): Promise<void>;
}
