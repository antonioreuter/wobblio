import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
  SNSClient,
  CreatePlatformEndpointCommand,
  PublishCommand,
} from '@aws-sdk/client-sns';
import { SSMClient } from '@aws-sdk/client-ssm';
import { SnsPushNotifierAdapter } from '@infrastructure/adapters/notifications/SnsPushNotifierAdapter';
import type { DeviceToken } from '@core/ports/notifications/IDeviceTokenRepository';

const BOTH_ARNS = {
  Parameters: [
    { Name: '/wobblio/config/push/fcm_platform_arn', Value: 'arn:fcm-app' },
    { Name: '/wobblio/config/push/apns_platform_arn', Value: 'arn:apns-app' },
  ],
};

describe('SnsPushNotifierAdapter', () => {
  let snsSend: ReturnType<typeof vi.spyOn>;
  let ssmSend: ReturnType<typeof vi.spyOn>;
  let queries: Array<{ sql: unknown; params: unknown }>;

  // A fake client that records its queries into the shared `queries` array and returns the
  // seeded tokens for the device_token SELECT. The adapter reuses the caller's client — it
  // must never open its own connection.
  function clientReturning(tokens: DeviceToken[]): PoolClient {
    return {
      query: vi.fn(async (sql: unknown, params?: unknown) => {
        queries.push({ sql, params });
        if (typeof sql === 'string' && sql.includes('SELECT id, platform, token')) return { rows: tokens };
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as PoolClient;
  }

  const deletes = () => queries.filter((q) => typeof q.sql === 'string' && (q.sql as string).startsWith('DELETE'));
  const creates = () => snsSend.mock.calls.filter((c) => c[0] instanceof CreatePlatformEndpointCommand);
  const publishes = () => snsSend.mock.calls.filter((c) => c[0] instanceof PublishCommand);

  beforeEach(() => {
    queries = [];
    snsSend = vi.spyOn(SNSClient.prototype, 'send' as never);
    ssmSend = vi.spyOn(SSMClient.prototype, 'send' as never);
    ssmSend.mockResolvedValue(BOTH_ARNS as never);
    snsSend.mockImplementation((async (command: unknown) => {
      if (command instanceof CreatePlatformEndpointCommand) {
        return { EndpointArn: `arn:endpoint:${command.input.Token}` };
      }
      return {};
    }) as never);
  });

  afterEach(() => vi.restoreAllMocks());

  function adapter(tokens: DeviceToken[]): SnsPushNotifierAdapter {
    return new SnsPushNotifierAdapter(clientReturning(tokens), 'eu-west-1', 'dev');
  }

  it('creates an endpoint and publishes once per registered token', async () => {
    await adapter([
      { id: 'a', platform: 'FCM', token: 'tok-fcm' },
      { id: 'b', platform: 'APNS', token: 'tok-apns' },
    ]).push('tenant-1', 'Title', 'Body', { type: 'INVOICE_PARSED', path: '/invoices/inv-1', invoiceId: 'inv-1' });

    expect(creates()).toHaveLength(2);
    expect(publishes()).toHaveLength(2);
    expect((publishes()[0][0] as PublishCommand).input.MessageStructure).toBe('json');
    expect(deletes()).toHaveLength(0);
  });

  it('never throws when SNS publish fails, and does not prune on a transient error', async () => {
    snsSend.mockImplementation((async (command: unknown) => {
      if (command instanceof CreatePlatformEndpointCommand) return { EndpointArn: 'arn:e' };
      throw new Error('transient SNS blip');
    }) as never);

    await expect(
      adapter([{ id: 'a', platform: 'FCM', token: 'tok' }]).push('tenant-1', 'T', 'B'),
    ).resolves.toBeUndefined();
    expect(deletes()).toHaveLength(0);
  });

  it('prunes a token when SNS reports the endpoint permanently dead', async () => {
    snsSend.mockImplementation((async (command: unknown) => {
      if (command instanceof CreatePlatformEndpointCommand) return { EndpointArn: 'arn:e' };
      throw Object.assign(new Error('gone'), { name: 'EndpointDisabledException' });
    }) as never);

    await adapter([{ id: 'dead-1', platform: 'FCM', token: 'tok' }]).push('tenant-1', 'T', 'B');

    expect(deletes()).toHaveLength(1);
    expect(deletes()[0].params).toEqual(['dead-1']);
  });

  it('skips a token whose platform ARN is not configured', async () => {
    ssmSend.mockResolvedValue({
      Parameters: [{ Name: '/wobblio/config/push/fcm_platform_arn', Value: 'arn:fcm-app' }],
    } as never);

    await adapter([{ id: 'a', platform: 'APNS', token: 'tok-apns' }]).push('tenant-1', 'T', 'B');

    expect(creates()).toHaveLength(0);
    expect(publishes()).toHaveLength(0);
  });

  it('makes no SNS calls when the tenant has no registered tokens', async () => {
    await adapter([]).push('tenant-1', 'T', 'B');
    expect(snsSend).not.toHaveBeenCalled();
  });

  it('is best-effort if loading the platform ARNs fails (never throws)', async () => {
    ssmSend.mockRejectedValue(new Error('SSM unavailable') as never);
    await expect(adapter([{ id: 'a', platform: 'FCM', token: 'tok' }]).push('t', 'T', 'B')).resolves.toBeUndefined();
    expect(snsSend).not.toHaveBeenCalled();
  });
});
