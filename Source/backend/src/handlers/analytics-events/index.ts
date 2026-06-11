import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SqsAnalyticsQueueAdapter } from '@infrastructure/adapters/SqsAnalyticsQueueAdapter';
import type { IAnalyticsQueuePort, FunnelEvent } from '@core/ports/IAnalyticsQueuePort';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const VALID_EVENTS: ReadonlySet<string> = new Set<FunnelEvent>([
  'hero_cta_click',
  'pricing_view',
  'signup_start',
  'signup_complete',
  'waitlist_join',
]);

const json = (statusCode: number, body: object): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function processAnalyticsEvent(
  port: IAnalyticsQueuePort,
  rawBody: unknown,
): Promise<APIGatewayProxyResult> {
  if (!rawBody || typeof rawBody !== 'object') {
    return json(400, { error: 'invalid request body' });
  }

  const { event } = rawBody as Record<string, unknown>;
  if (typeof event !== 'string' || !VALID_EVENTS.has(event)) {
    return json(400, { error: 'invalid event' });
  }

  await port.enqueue(event as FunnelEvent);
  return json(200, { ok: true });
}

export const handler = async (event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> => {
  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : null;
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const port: IAnalyticsQueuePort = new SqsAnalyticsQueueAdapter(
    REGION,
    process.env.ANALYTICS_QUEUE_URL!,
  );
  return processAnalyticsEvent(port, parsedBody);
};
