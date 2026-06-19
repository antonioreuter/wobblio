import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

// Bedrock has no LocalStack equivalent, so even local dev calls real AWS. Two
// overrides make that work while the rest of the stack stays on LocalStack:
//   - pin the regional endpoint, so the client ignores the global AWS_ENDPOINT_URL
//     that routes every other SDK client to LocalStack;
//   - load real profile credentials, since the LocalStack clients run on fake creds.
// On a deployed stage neither override applies — the Lambda role and default
// endpoint resolution are correct.
export function buildBedrockRuntimeClient(region: string): BedrockRuntimeClient {
  if (process.env.STAGE !== 'local') {
    return new BedrockRuntimeClient({ region });
  }
  return new BedrockRuntimeClient({
    region,
    endpoint: `https://bedrock-runtime.${region}.amazonaws.com`,
    credentials: fromIni({ profile: process.env.AWS_PROFILE ?? 'reuterAdmin' }),
  });
}
