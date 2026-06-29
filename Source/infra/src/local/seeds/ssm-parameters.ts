import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { loadAppConfig, configParamName } from '../../cdk/config/appConfig';

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

  // Single source of truth: the committed config/config.local.json (the same file the
  // local bootstrap CDK stack uses), seeded flat to match the backend's CONFIG_STAGE-unset
  // reads. Real Bedrock IDs live there — local AI hits real Bedrock, so the worker resolves
  // invokable model IDs (Qwen vision on-demand; Claude via eu.* inference profiles).
  const config = loadAppConfig('local');

  for (const [relativeKey, value] of Object.entries(config)) {
    await putParam(client, configParamName('local', relativeKey), value);
  }

  console.log('SSM parameters seeded.\n');
}

if (require.main === module) {
  seedSsmParameters().catch((err) => {
    console.error('SSM seed failed:', err);
    process.exit(1);
  });
}
