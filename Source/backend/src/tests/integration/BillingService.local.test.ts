import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { S3Client, ListObjectsV2Command, CreateBucketCommand, DeleteObjectsCommand, DeleteBucketCommand } from '@aws-sdk/client-s3';
import { BillingService } from '@core/services/BillingService';
import { MockBillingGatewayAdapter } from '@infrastructure/adapters/MockBillingGatewayAdapter';
import { SsmBillingWhitelistAdapter } from '@infrastructure/adapters/SsmBillingWhitelistAdapter';
import { PaymentTransactionRepositoryAdapter } from '@infrastructure/adapters/PaymentTransactionRepositoryAdapter';
import { S3BillingArchiveAdapter } from '@infrastructure/adapters/S3BillingArchiveAdapter';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/AppUserRepositoryAdapter';

const REGION = 'eu-west-1';
const ARCHIVE_BUCKET = 'wobblio-billing-archive-local';
const WEB_APP_URL = 'http://localhost:3000';

const WHITELISTED_EMAIL = 'antonioreuter@gmail.com';

describe('BillingService — LocalStack end-to-end', () => {
  let pool: Pool;
  let s3: S3Client;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'wobblio_local',
      user: 'wobblio_dev',
      password: 'wobblio_dev_secret',
      max: 2,
    });
    s3 = new S3Client({ region: REGION, forcePathStyle: !!process.env.AWS_ENDPOINT_URL });
    await s3.send(new CreateBucketCommand({ Bucket: ARCHIVE_BUCKET })).catch((e: { name?: string }) => {
      if (e.name !== 'BucketAlreadyOwnedByYou' && e.name !== 'BucketAlreadyExists') throw e;
    });
  });

  afterAll(async () => {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: ARCHIVE_BUCKET }));
    if (listed.Contents?.length) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: ARCHIVE_BUCKET,
        Delete: { Objects: listed.Contents.map(o => ({ Key: o.Key! })) },
      }));
    }
    await s3.send(new DeleteBucketCommand({ Bucket: ARCHIVE_BUCKET }));
    await pool.end();
  });

  const insertUser = async (email: string, status: 'ACTIVE' | 'WAITLIST'): Promise<string> => {
    const sub = `sub-${randomUUID()}`;
    const result = await pool.query<{ provision_new_user: string }>(
      'SELECT provision_new_user($1, $2, $3)',
      [sub, email, status],
    );
    return result.rows[0]!.provision_new_user;
  };

  const userRow = async (id: string) => {
    const res = await pool.query(
      'SELECT id, email, role, status, stripe_customer_id FROM app_user WHERE id = $1',
      [id],
    );
    return res.rows[0];
  };

  const ptCount = async (userId: string): Promise<number> => {
    const res = await pool.query<{ c: string }>(
      'SELECT COUNT(*)::text AS c FROM payment_transaction WHERE user_id = $1',
      [userId],
    );
    return parseInt(res.rows[0]!.c, 10);
  };

  const buildService = () =>
    new BillingService(
      new MockBillingGatewayAdapter(),
      new SsmBillingWhitelistAdapter(REGION),
      new PaymentTransactionRepositoryAdapter(pool),
      new S3BillingArchiveAdapter(REGION, ARCHIVE_BUCKET),
      new AppUserRepositoryAdapter(pool),
      {
        successUrl: `${WEB_APP_URL}/upgrade/success`,
        cancelUrl: `${WEB_APP_URL}/upgrade/cancel?reason=not_whitelisted`,
      },
    );

  it('promotes a whitelisted waitlisted user to PREMIUM/ACTIVE and persists the transaction + S3 archive', async () => {
    const userId = await insertUser(WHITELISTED_EMAIL, 'WAITLIST');

    const before = await userRow(userId);
    expect(before.role).toBe('STANDARD');
    expect(before.status).toBe('WAITLIST');

    const result = await buildService().createCheckoutSession(
      { id: userId, email: WHITELISTED_EMAIL },
      'ANNUAL',
    );

    expect(result.status).toBe('PENDING');
    expect(result.checkoutUrl).toContain('/upgrade/success');
    expect(result.checkoutUrl).toContain('session_id=');

    const after = await userRow(userId);
    expect(after.role).toBe('PREMIUM');
    expect(after.status).toBe('ACTIVE');
    expect(after.stripe_customer_id).toMatch(/^cus_mock_/);

    expect(await ptCount(userId)).toBe(1);

    const yyyy = new Date().getUTCFullYear().toString();
    const objs = await s3.send(new ListObjectsV2Command({ Bucket: ARCHIVE_BUCKET, Prefix: yyyy }));
    expect((objs.Contents?.length ?? 0)).toBeGreaterThan(0);
  });

  it('cancels checkout for a non-whitelisted email with no DB or S3 side effects', async () => {
    const email = `rejected-${Date.now()}@test.nl`;
    const userId = await insertUser(email, 'ACTIVE');

    const ptBefore = await ptCount(userId);
    const objsBefore = await s3.send(new ListObjectsV2Command({ Bucket: ARCHIVE_BUCKET }));
    const objCountBefore = objsBefore.Contents?.length ?? 0;

    const result = await buildService().createCheckoutSession(
      { id: userId, email },
      'ANNUAL',
    );

    expect(result.status).toBe('CANCELED');
    expect(result.checkoutUrl).toContain('/upgrade/cancel');
    expect(result.checkoutUrl).toContain('reason=not_whitelisted');

    const after = await userRow(userId);
    expect(after.role).toBe('STANDARD');
    expect(after.stripe_customer_id).toBeNull();
    expect(await ptCount(userId)).toBe(ptBefore);

    const objsAfter = await s3.send(new ListObjectsV2Command({ Bucket: ARCHIVE_BUCKET }));
    expect(objsAfter.Contents?.length ?? 0).toBe(objCountBefore);
  });

  it('is idempotent on webhook event replay (same stripe_event_id)', async () => {
    const userId = await insertUser(WHITELISTED_EMAIL, 'ACTIVE');
    const svc = buildService();
    const event = {
      id: `evt_replay_${randomUUID()}`,
      type: 'checkout.session.completed' as const,
      occurredAt: new Date(),
      userId,
      customerId: 'cus_mock_replay',
      plan: 'ANNUAL' as const,
      amount: 25,
      currency: 'EUR',
      rawPayload: { mock: true, replay_test: true },
    };

    await svc.processWebhookEvent(event);
    const after1 = await ptCount(userId);

    await svc.processWebhookEvent(event);
    const after2 = await ptCount(userId);

    expect(after2).toBe(after1);
  });
});
