import pino from 'pino';

export interface LambdaLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

// Resolve the active level from the environment, honouring an optional auto-revert
// stamp. The admin Troubleshooting page can raise the level live (Lambda env update)
// with a `LOG_LEVEL_EXPIRES_AT` deadline; once that passes we fall back to INFO so a
// forgotten debug level cannot keep inflating log volume/PII exposure. Re-evaluated
// per logger creation (per request), so the revert needs no scheduler.
export function resolveLogLevel(): string {
  const configured = process.env.LOG_LEVEL ?? (process.env.DEBUG ? 'debug' : 'info');
  const expiresAt = process.env.LOG_LEVEL_EXPIRES_AT;
  if (!expiresAt) return configured;
  const deadline = Date.parse(expiresAt);
  if (Number.isFinite(deadline) && Date.now() > deadline) return 'info';
  return configured;
}

export function createLambdaLogger(service: string, requestId: string): LambdaLogger {
  // pino's signature is (mergingObject, msg); our callers use (msg, data). Without
  // this adapter pino treats `data` as a printf arg and silently drops it.
  const level = resolveLogLevel();
  // Serialize Error values under `err`/`cause` to full {type, message, stack} —
  // logging only `.message` discards the stack and makes faults un-debuggable.
  const logger = pino({
    level,
    serializers: { err: pino.stdSerializers.err, cause: pino.stdSerializers.err },
  }).child({ service, requestId });
  const at = (level: 'info' | 'warn' | 'error' | 'debug') =>
    (msg: string, data?: Record<string, unknown>): void => {
      if (data) logger[level](data, msg);
      else logger[level](msg);
    };
  return { info: at('info'), warn: at('warn'), error: at('error'), debug: at('debug') };
}
