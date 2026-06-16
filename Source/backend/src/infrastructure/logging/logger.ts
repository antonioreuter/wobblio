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
  const logger = pino({ level: 'info' }).child({ service, requestId });
  const at = (level: 'info' | 'warn' | 'error' | 'debug') =>
    (msg: string, data?: Record<string, unknown>): void => {
      if (data) logger[level](data, msg);
      else logger[level](msg);
    };
  return { info: at('info'), warn: at('warn'), error: at('error'), debug: at('debug') };
}
