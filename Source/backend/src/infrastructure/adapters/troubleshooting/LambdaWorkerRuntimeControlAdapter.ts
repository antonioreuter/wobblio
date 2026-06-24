import {
  LambdaClient,
  GetFunctionConfigurationCommand,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import type { IWorkerRuntimeControl, LogLevelState } from '@core/ports/troubleshooting/IWorkerRuntimeControl';
import type { LogLevel } from '@core/ports/troubleshooting/IIngestionLogReader';

const LEVEL_ENV = 'LOG_LEVEL';
const EXPIRY_ENV = 'LOG_LEVEL_EXPIRES_AT';
const VALID: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'];

// Reads/writes the ingestion worker's log level through its Lambda environment.
// The worker's logger re-reads these vars per request, so an update takes effect on
// the next cold/warm container without a redeploy. Read-merge-write preserves every
// other env var (UpdateFunctionConfiguration replaces the whole Environment block).
export class LambdaWorkerRuntimeControlAdapter implements IWorkerRuntimeControl {
  private readonly client: LambdaClient;

  constructor(region: string, private readonly functionName: string) {
    this.client = new LambdaClient({ region });
  }

  async getLogLevel(): Promise<LogLevelState> {
    const vars = await this.readEnv();
    return toState(vars);
  }

  async setLogLevel(level: LogLevel, expiresAt: Date | null): Promise<void> {
    const vars = { ...(await this.readEnv()) };
    vars[LEVEL_ENV] = level;
    if (expiresAt) vars[EXPIRY_ENV] = expiresAt.toISOString();
    else delete vars[EXPIRY_ENV];

    await this.client.send(new UpdateFunctionConfigurationCommand({
      FunctionName: this.functionName,
      Environment: { Variables: vars },
    }));
  }

  private async readEnv(): Promise<Record<string, string>> {
    const config = await this.client.send(
      new GetFunctionConfigurationCommand({ FunctionName: this.functionName }),
    );
    return config.Environment?.Variables ?? {};
  }
}

function toState(vars: Record<string, string>): LogLevelState {
  const configuredLevel = normalize(vars[LEVEL_ENV]) ?? (vars.DEBUG ? 'debug' : 'info');
  const expiresAt = vars[EXPIRY_ENV] ?? null;
  const elapsed = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
  return {
    configuredLevel,
    effectiveLevel: elapsed ? 'info' : configuredLevel,
    expiresAt: elapsed ? null : expiresAt,
  };
}

function normalize(value: string | undefined): LogLevel | null {
  return VALID.includes(value as LogLevel) ? (value as LogLevel) : null;
}
