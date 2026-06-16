import { describe, it, beforeAll, expect } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { WobblioDbStack } from '../src/cdk/stacks/WobblioDbStack';
import { WobblioAuthStack } from '../src/cdk/stacks/WobblioAuthStack';
import { WobblioStorageStack } from '../src/cdk/stacks/WobblioStorageStack';
import { WobblioBackendStack } from '../src/cdk/stacks/WobblioBackendStack';
import type { EnvironmentConfig } from '../src/cdk/config/environment';

// A concrete (non-agnostic) env so ARN-scoped IAM resources render with account/region.
const ENV = { account: '123456789012', region: 'eu-west-1' };

// isLocal=true skips the route53/ACM custom-domain block (which needs a hosted-zone
// lookup); the IAM grants under test are identical across stages.
const config: EnvironmentConfig = {
  stage: 'dev',
  isLocal: true,
  region: ENV.region,
  account: ENV.account,
  localstackEndpoint: undefined,
  zoneDomain: 'wobblio.com',
  appDomain: 'app.dev.wobblio.com',
  apiDomain: 'api.dev.wobblio.com',
  webCertSsmPath: '/wobblio/web/dev/certificate-arn',
  dbSecretParam: '/shared/db/wobblio_dev/secret-arn',
  resourceName: (base: string) => `wobblio-${base}-dev`,
  cdkEnv: ENV,
};

const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

// Asserts some IAM policy attached to a role whose name contains `roleNeedle` has an
// Allow statement covering every action in `actions` on a resource matching `resourceNeedle`.
// Normalizes Action/Resource (CDK renders single entries as scalars) and substring-matches
// the resource's JSON so it works for both concrete ARN strings and CFN intrinsic objects.
function expectRolePolicyAllows(
  template: Template,
  roleNeedle: string,
  actions: string[],
  resourceNeedle: string,
): void {
  const policies = template.findResources('AWS::IAM::Policy');
  const matched = Object.values(policies).some((policy) => {
    const props = policy.Properties ?? {};
    if (typeof props.PolicyName !== 'string' || !props.PolicyName.includes(roleNeedle)) return false;
    const statements = props.PolicyDocument?.Statement ?? [];
    return statements.some((stmt: Record<string, unknown>) => {
      if (stmt.Effect !== 'Allow') return false;
      const stmtActions = asArray(stmt.Action as string | string[]);
      if (!actions.every((a) => stmtActions.includes(a))) return false;
      const resources = asArray(stmt.Resource as unknown);
      return resources.some((r) => JSON.stringify(r).includes(resourceNeedle));
    });
  });
  expect(
    matched,
    `expected a role matching "${roleNeedle}" to allow [${actions.join(', ')}] on a resource matching "${resourceNeedle}"`,
  ).toBe(true);
}

describe('WobblioBackendStack IAM grants', () => {
  let template: Template;

  beforeAll(() => {
    // Disable NodejsFunction esbuild bundling — we only assert synthesized IAM,
    // and bundling would couple this test to backend compilation + slow it down.
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
    const dbStack = new WobblioDbStack(app, 'DbStack', { env: ENV, config });
    const authStack = new WobblioAuthStack(app, 'AuthStack', { env: ENV, config, dbStack });
    const storageStack = new WobblioStorageStack(app, 'StorageStack', { env: ENV, config, dbStack });
    const backendStack = new WobblioBackendStack(app, 'BackendStack', {
      env: ENV,
      config,
      dbStack,
      authStack,
      storageStack,
    });
    template = Template.fromStack(backendStack);
  });

  // Regression: ingestion worker 502'd on AccessDeniedException for ssm:GetParameter
  // against /wobblio/config/models/vision_parser. The worker resolves swappable model
  // IDs (vision/auxiliary/embedder) and the AI spend cap from SSM at runtime.
  it('grants the ingestion worker ssm:GetParameter on model config params', () => {
    expectRolePolicyAllows(
      template,
      'ingestionworkerServiceRole',
      ['ssm:GetParameter'],
      'parameter/wobblio/config/models',
    );
  });

  it('grants the ingestion worker ssm:GetParameter on the AI spend-cap param', () => {
    expectRolePolicyAllows(
      template,
      'ingestionworkerServiceRole',
      ['ssm:GetParameter'],
      'parameter/wobblio/config/ai',
    );
  });

  // Regression: models are invoked via cross-region inference profiles (eu.amazon.nova-lite,
  // eu.anthropic.claude-haiku), which need bedrock:InvokeModel on BOTH the inference-profile
  // ARN and the foundation models in every member region (all-region wildcard).
  it('grants the ingestion worker bedrock:InvokeModel on inference profiles', () => {
    expectRolePolicyAllows(
      template,
      'ingestionworkerServiceRole',
      ['bedrock:InvokeModel'],
      'inference-profile',
    );
  });

  it('grants the ingestion worker bedrock:InvokeModel on cross-region foundation models', () => {
    expectRolePolicyAllows(
      template,
      'ingestionworkerServiceRole',
      ['bedrock:InvokeModel'],
      'arn:aws:bedrock:*::foundation-model/*',
    );
  });

  // Regression: api-handler 502'd on confirm (s3:GetObject for HeadObject) and 500'd
  // on delete (s3:DeleteObject). It also reads per-plan upload quotas via GetParameters.
  it('grants the api-handler read + delete on the uploads bucket', () => {
    expectRolePolicyAllows(
      template,
      'apihandlerServiceRole',
      ['s3:GetObject*'],
      'UploadsBucket',
    );
    expectRolePolicyAllows(
      template,
      'apihandlerServiceRole',
      ['s3:DeleteObject*'],
      'UploadsBucket',
    );
  });

  it('grants the api-handler ssm:GetParameters on per-plan upload quotas', () => {
    expectRolePolicyAllows(
      template,
      'apihandlerServiceRole',
      ['ssm:GetParameters'],
      'parameter/wobblio/config/quotas/standard_uploads_per_week',
    );
  });
});
