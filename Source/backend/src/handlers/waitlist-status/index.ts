import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { buildPool } from '@infrastructure/config/db';
import { WaitlistStatusDbAdapter } from '@infrastructure/adapters/waitlist/WaitlistStatusDbAdapter';
import type { IWaitlistStatusPort } from '@core/ports/waitlist/IWaitlistStatusPort';

const json = (statusCode: number, body: object, extra: Record<string, string> = {}): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...extra },
  body: JSON.stringify(body),
});

export async function buildWaitlistStatusResponse(port: IWaitlistStatusPort): Promise<APIGatewayProxyResult> {
  const waitlistActive = await port.isWaitlistActive();
  return json(200, { waitlistActive }, {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
  });
}

const MAX_FREE_USERS = parseInt(process.env.MAX_FREE_USERS ?? '5000', 10);

export const handler = async (_event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> => {
  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
  );
  return buildWaitlistStatusResponse(new WaitlistStatusDbAdapter(pool, MAX_FREE_USERS));
};
