import type { BedrockMessage, BedrockConverseRequest, BedrockConverseResult } from '../ports/ai/IBedrockConverse';
import { SchemaValidationError } from './errors';

// Generalized "call → validate → retry-with-errors → throw" helper for structured
// Bedrock calls (Appendix B). On the first validation failure it retries once,
// echoing the validation errors back; a second failure throws SchemaValidationError
// so the caller routes to the DLQ. The spend-guarded call is injected so this stays
// free of any service/SDK dependency.

export type JsonValidation<T> = { ok: true; value: T } | { ok: false; issues: string };

export interface LlmJsonOptions<T> {
  call: (request: BedrockConverseRequest) => Promise<BedrockConverseResult>;
  buildRequest: (messages: BedrockMessage[]) => BedrockConverseRequest;
  messages: BedrockMessage[];
  validate: (content: string) => JsonValidation<T>;
}

export async function callJsonWithRetry<T>(options: LlmJsonOptions<T>): Promise<T> {
  const first = await options.call(options.buildRequest(options.messages));
  const firstResult = options.validate(first.content);
  if (firstResult.ok) return firstResult.value;

  const retryMessages: BedrockMessage[] = [
    ...options.messages,
    { role: 'assistant', content: first.content },
    {
      role: 'user',
      content: `<validation_errors>${firstResult.issues}</validation_errors>\nReturn corrected JSON only.`,
    },
  ];
  const second = await options.call(options.buildRequest(retryMessages));
  const secondResult = options.validate(second.content);
  if (secondResult.ok) return secondResult.value;

  throw new SchemaValidationError(secondResult.issues);
}
