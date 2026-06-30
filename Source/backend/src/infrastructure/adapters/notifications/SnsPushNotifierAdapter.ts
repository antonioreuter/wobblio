import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { SNSClient, CreatePlatformEndpointCommand, PublishCommand } from '@aws-sdk/client-sns';
import type { PoolClient } from 'pg';
import type { IPushNotifier, PushData } from '@core/ports/notifications/IPushNotifier';
import type { DeviceToken, PushPlatform } from '@core/ports/notifications/IDeviceTokenRepository';
import { DeviceTokenRepositoryAdapter } from './DeviceTokenRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const FCM_ARN_PARAM = stageScopeConfig('/wobblio/config/push/fcm_platform_arn');
const APNS_ARN_PARAM = stageScopeConfig('/wobblio/config/push/apns_platform_arn');

// SNS error names that mean the endpoint is permanently dead → prune the token.
const DEAD_ENDPOINT_ERRORS = new Set(['EndpointDisabledException', 'InvalidParameterException']);

type PlatformArns = Partial<Record<PushPlatform, string>>;

// Real device push via SNS platform endpoints (16f). Best-effort by contract: every public
// failure mode is swallowed + logged so a push problem never fails the ingestion worker.
// Reads the per-platform application ARNs from stage-scoped SSM; a missing ARN means that
// platform is unconfigured and is skipped (e.g. before the platform-app runbook has run).
//
// Runs its device_token reads/prunes on the CALLER's PoolClient — the worker calls push()
// post-COMMIT with its (now idle) client, so the adapter must NOT borrow a second connection:
// the deployed worker pool is max:1, so a `pool.connect()` here would deadlock until timeout.
export class SnsPushNotifierAdapter implements IPushNotifier {
  private readonly sns: SNSClient;
  private readonly ssm: SSMClient;
  private readonly apnsKey: string;
  private arns: PlatformArns | null = null;

  constructor(private readonly client: PoolClient, region: string, stage: string) {
    this.sns = new SNSClient({ region });
    this.ssm = new SSMClient({ region });
    // Dev devices register against the APNs sandbox; prod against production APNs.
    this.apnsKey = stage === 'prod' ? 'APNS' : 'APNS_SANDBOX';
  }

  async push(tenantId: string, title: string, body: string, data?: PushData): Promise<void> {
    try {
      const arns = await this.platformArns();
      const tokens = await this.withTenant(tenantId, (repo) => repo.listForTenant());
      const dead = await this.deliver(tokens, arns, title, body, data);
      if (dead.length > 0) {
        await this.withTenant(tenantId, async (repo) => {
          for (const id of dead) await repo.markDead(id);
        });
      }
    } catch (err) {
      logPushFailure('sns_push_failed', tenantId, err);
    }
  }

  // CreatePlatformEndpoint (idempotent per token) then Publish. Returns the ids of tokens
  // SNS rejected as permanently dead so the caller can prune them.
  private async deliver(
    tokens: DeviceToken[],
    arns: PlatformArns,
    title: string,
    body: string,
    data: PushData | undefined,
  ): Promise<string[]> {
    const dead: string[] = [];
    for (const token of tokens) {
      const platformArn = arns[token.platform];
      if (!platformArn) continue;
      try {
        await this.publishOne(token, platformArn, title, body, data);
      } catch (err) {
        if (isDeadEndpoint(err)) dead.push(token.id);
        else logPushFailure('sns_publish_failed', token.id, err);
      }
    }
    return dead;
  }

  private async publishOne(
    token: DeviceToken,
    platformArn: string,
    title: string,
    body: string,
    data: PushData | undefined,
  ): Promise<void> {
    const endpoint = await this.sns.send(
      new CreatePlatformEndpointCommand({ PlatformApplicationArn: platformArn, Token: token.token }),
    );
    await this.sns.send(
      new PublishCommand({
        TargetArn: endpoint.EndpointArn,
        MessageStructure: 'json',
        Message: this.buildMessage(token.platform, title, body, data),
      }),
    );
  }

  // SNS JSON message: a `default` fallback string plus the platform-native envelope.
  private buildMessage(platform: PushPlatform, title: string, body: string, data?: PushData): string {
    if (platform === 'FCM') {
      const gcm = JSON.stringify({ notification: { title, body }, data });
      return JSON.stringify({ default: body, GCM: gcm });
    }
    const apns = JSON.stringify({ aps: { alert: { title, body } }, data });
    return JSON.stringify({ default: body, [this.apnsKey]: apns });
  }

  private async platformArns(): Promise<PlatformArns> {
    if (this.arns) return this.arns;
    const response = await this.ssm.send(
      new GetParametersCommand({ Names: [FCM_ARN_PARAM, APNS_ARN_PARAM] }),
    );
    const byName: Record<string, string> = {};
    for (const param of response.Parameters ?? []) {
      if (param.Name && param.Value) byName[param.Name] = param.Value;
    }
    this.arns = { FCM: byName[FCM_ARN_PARAM], APNS: byName[APNS_ARN_PARAM] };
    return this.arns;
  }

  // A short tenant-scoped transaction on the caller's client; RLS needs the tenant context
  // set first. Kept off the slow SNS round-trips (list, then deliver, then prune) so no DB
  // transaction is held open across the network calls.
  private async withTenant<T>(
    tenantId: string,
    fn: (repo: DeviceTokenRepositoryAdapter) => Promise<T>,
  ): Promise<T> {
    await this.client.query('BEGIN');
    try {
      await new TenantContextAdapter(this.client).setTenantId(tenantId);
      const result = await fn(new DeviceTokenRepositoryAdapter(this.client));
      await this.client.query('COMMIT');
      return result;
    } catch (err) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw err;
    }
  }
}

function isDeadEndpoint(err: unknown): boolean {
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' && DEAD_ENDPOINT_ERRORS.has(name);
}

function logPushFailure(event: string, ref: string, err: unknown): void {
  console.error(JSON.stringify({ event, ref, err: err instanceof Error ? err.message : String(err) }));
}
