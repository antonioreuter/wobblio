/**
 * Local backend API harness — dev only.
 *
 * Runs the REAL Lambda handlers behind a tiny HTTP server on :3001 so the webapp
 * uses the same backend path locally as on AWS (API Gateway → apiHandler). It
 * emulates the API Gateway Cognito authorizer by decoding the Bearer token's
 * `sub` (decode-only: the dev box is trusted; AWS uses the real authorizer).
 */
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';

// Load the committed local env (DATABASE_URL, COGNITO_*, STAGE=local, …) before
// the handlers read process.env.
dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler as apiHandler } from '@handlers/api-handler';
import { handler as waitlistStatusHandler } from '@handlers/waitlist-status';
import { handler as analyticsEventsHandler } from '@handlers/analytics-events';
import { handler as shareInvoiceHandler } from '@handlers/share-invoice';
import { startIngestionPoller } from './ingestion-poller';

type LambdaHandler = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;

const PORT = 3001;
const PUBLIC_ROUTES: Record<string, LambdaHandler> = {
  '/waitlist/status': waitlistStatusHandler,
  '/analytics/events': analyticsEventsHandler,
};

// Public path-param route: GET /shared-invoices/{token} → share-invoice handler.
const SHARED_INVOICE_PREFIX = '/shared-invoices/';

function decodeSub(authorization?: string): string | undefined {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  const payload = token?.split('.')[1];
  if (!payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')).sub;
  } catch {
    return undefined;
  }
}

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const event = {
      httpMethod: req.method ?? 'GET',
      path: url.pathname,
      headers: req.headers as Record<string, string>,
      body: chunks.length ? Buffer.concat(chunks).toString('utf-8') : null,
      queryStringParameters: Object.fromEntries(url.searchParams),
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
    } as APIGatewayProxyEvent;

    let handler = PUBLIC_ROUTES[url.pathname];

    if (!handler && url.pathname.startsWith(SHARED_INVOICE_PREFIX)) {
      const token = decodeURIComponent(url.pathname.slice(SHARED_INVOICE_PREFIX.length));
      event.pathParameters = { token };
      handler = shareInvoiceHandler;
    }

    if (!handler) {
      const sub = decodeSub(req.headers.authorization);
      if (!sub) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event.requestContext as any).authorizer = { claims: { sub } };
      handler = apiHandler;
    }

    try {
      const result = await handler(event, {} as Context);
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...result.headers });
      res.end(result.body ?? '');
    } catch (err) {
      console.error('[local-api] handler error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal Server Error' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[local-api] backend listening on http://localhost:${PORT}`);
  startIngestionPoller();
});
