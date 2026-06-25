import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import tagVocabulary from './tag-vocabulary';

function buildSsmClient(): SSMClient {
  const endpoint = process.env.AWS_ENDPOINT_URL ?? process.env.LOCALSTACK_ENDPOINT;
  return new SSMClient({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    ...(endpoint ? { endpoint } : {}),
    credentials: endpoint
      ? { accessKeyId: 'test', secretAccessKey: 'test' }
      : undefined,
  });
}

async function putParam(client: SSMClient, name: string, value: string): Promise<void> {
  await client.send(
    new PutParameterCommand({ Name: name, Value: value, Type: 'String', Overwrite: true })
  );
  console.log(`  ✓ ${name}`);
}

export async function seedSsmParameters(): Promise<void> {
  const client = buildSsmClient();
  console.log('\nSeeding SSM parameters...');

  const params: Record<string, string> = {
    // Real Bedrock IDs (same as the dev account): local AI calls hit real Bedrock,
    // so the worker must resolve invokable model IDs, not mock placeholders.
    // Vision = Qwen3-VL (on-demand by foundation-model ID, no profile). Claude
    // models use eu.* cross-region inference profiles — not invokable on-demand
    // by bare foundation-model ID in eu-west-1.
    '/wobblio/config/models/vision_parser': 'qwen.qwen3-vl-235b-a22b',
    '/wobblio/config/models/pdf_parser': 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    '/wobblio/config/models/auxiliary': 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    '/wobblio/config/models/embedder': 'amazon.titan-embed-text-v2:0',
    '/wobblio/config/models/insight': 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    // Per-role weekly caps. SsmUploadQuotaAdapter requires every role's uploads +
    // failure-refunds param to exist (it fails closed on a missing cap), so all four
    // roles are seeded. -1 = unlimited (TESTER/ADMIN stay effectively uncapped).
    '/wobblio/config/quotas/standard_uploads_per_week': '3',
    '/wobblio/config/quotas/premium_uploads_per_week': '10',
    '/wobblio/config/quotas/tester_uploads_per_week': '-1',
    '/wobblio/config/quotas/admin_uploads_per_week': '-1',
    '/wobblio/config/quotas/household_uploads_per_week': '15',
    '/wobblio/config/quotas/standard_failure_refunds_per_week': '3',
    '/wobblio/config/quotas/premium_failure_refunds_per_week': '10',
    '/wobblio/config/quotas/tester_failure_refunds_per_week': '-1',
    '/wobblio/config/quotas/admin_failure_refunds_per_week': '-1',
    '/wobblio/config/quotas/max_free_waitlist_cap': '5000',
    '/wobblio/config/routing/max_stores': '3',
    '/wobblio/config/routing/min_split_saving_eur': '5.00',
    '/wobblio/config/tags/dedicated_call_enabled': 'false',
    '/wobblio/config/tags/vocabulary': JSON.stringify(tagVocabulary),
    '/wobblio/config/ops/email': 'antonioreuter@gmail.com',
    '/wobblio/config/web_app_url': 'http://localhost:3000',
    '/wobblio/config/billing/mock_premium_whitelist': 'antonioreuter@gmail.com',
  };

  for (const [name, value] of Object.entries(params)) {
    await putParam(client, name, value);
  }

  console.log('SSM parameters seeded.\n');
}

if (require.main === module) {
  seedSsmParameters().catch((err) => {
    console.error('SSM seed failed:', err);
    process.exit(1);
  });
}
