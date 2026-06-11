import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => ({
  statusCode: 200,
  body: JSON.stringify({ status: 'ok' }),
});
