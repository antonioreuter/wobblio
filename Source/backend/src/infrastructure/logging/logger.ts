import pino from 'pino';

export interface LambdaLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

export function createLambdaLogger(service: string, requestId: string): LambdaLogger {
  // pino's signature is (mergingObject, msg); our callers use (msg, data). Without
  // this adapter pino treats `data` as a printf arg and silently drops it.
  // Default INFO; set LOG_LEVEL=debug (or DEBUG=1) to surface debug logs such as the
  // full parsed-receipt JSON from the ingestion worker.
  const level = process.env.LOG_LEVEL ?? (process.env.DEBUG ? 'debug' : 'info');
  const logger = pino({ level }).child({ service, requestId });
  const at = (level: 'info' | 'warn' | 'error' | 'debug') =>
    (msg: string, data?: Record<string, unknown>): void => {
      if (data) logger[level](data, msg);
      else logger[level](msg);
    };
  return { info: at('info'), warn: at('warn'), error: at('error'), debug: at('debug') };
}
