import pino from 'pino';

export interface LambdaLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

export function createLambdaLogger(service: string, requestId: string): LambdaLogger {
  return pino({ level: 'info' }).child({ service, requestId });
}
