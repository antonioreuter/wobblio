import { describe, it, beforeAll, expect } from 'vitest';
import { App, Aspects } from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { WobblioDbStack } from '../src/cdk/stacks/WobblioDbStack';
import { WobblioStorageStack } from '../src/cdk/stacks/WobblioStorageStack';
import { WobblioDataAiPipelineStack } from '../src/cdk/stacks/WobblioDataAiPipelineStack';
import type { EnvironmentConfig } from '../src/cdk/config/environment';

const ENV = { account: '123456789012', region: 'eu-west-1' };

// isLocal=true keeps parity with the backend-stack test: no custom-domain lookups exist
// in this stack, and the IAM grants under test are identical across stages.
const config: EnvironmentConfig = {
  stage: 'dev',
  isLocal: true,
  region: ENV.region,
  account: ENV.account,
  localstackEndpoint: undefined,
  zoneDomain: 'wobblio.com',
  appDomain: 'app.dev.wobblio.com',
  adminDomain: 'admin.dev.wobblio.com',
  apiDomain: 'api.dev.wobblio.com',
  webCertSsmPath: '/wobblio/web/dev/certificate-arn',
  adminCertSsmPath: '/wobblio/admin/dev/certificate-arn',
  adminWafAclSsmPath: '/wobblio/admin/dev/waf-acl-arn',
  dbSecretParam: '/shared/db/wobblio_dev/secret-arn',
  logLevel: 'debug',
  resourceName: (base: string) => `wobblio-${base}-dev`,
  cdkEnv: ENV,
};

const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

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

describe('WobblioDataAiPipelineStack', () => {
  let template: Template;
  let stack: WobblioDataAiPipelineStack;

  beforeAll(() => {
    // Disable NodejsFunction esbuild bundling — we assert synthesized infra only.
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
    Aspects.of(app).add(new AwsSolutionsChecks());
    const dbStack = new WobblioDbStack(app, 'DbStack', { env: ENV, config });
    const storageStack = new WobblioStorageStack(app, 'StorageStack', { env: ENV, config, dbStack });
    stack = new WobblioDataAiPipelineStack(app, 'DataAiStack', {
      env: ENV,
      config,
      dbStack,
      storageStack,
    });
    template = Template.fromStack(stack);
  });

  it('creates the agentic queue (360s visibility) with a DLQ redrive of 3', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'wobblio-agentic-dev',
      VisibilityTimeout: 360,
      RedrivePolicy: Match.objectLike({ maxReceiveCount: 3 }),
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'wobblio-agentic-dlq-dev',
      MessageRetentionPeriod: 1209600, // 14 days
    });
  });

  it('alarms when the DLQ has any visible message', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ComparisonOperator: 'GreaterThanThreshold',
      Threshold: 0,
      EvaluationPeriods: 1,
      MetricName: 'ApproximateNumberOfMessagesVisible',
    });
  });

  it('runs the worker on Node 24 / ARM64 with reserved concurrency 5', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wobblio-agentic-worker-dev',
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      ReservedConcurrentExecutions: 5,
      Timeout: 300,
    });
  });

  it('wires the SQS event source with partial-batch failure reporting', () => {
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 1,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
      ScalingConfig: { MaximumConcurrency: 5 },
    });
  });

  it('grants the worker bedrock invoke + scoped model/feature SSM + queue consume', () => {
    expectRolePolicyAllows(template, 'AgenticWorkerLambdaServiceRole', ['bedrock:InvokeModel'], 'inference-profile');
    expectRolePolicyAllows(template, 'AgenticWorkerLambdaServiceRole', ['bedrock:InvokeModel'], 'foundation-model/*');
    expectRolePolicyAllows(template, 'AgenticWorkerLambdaServiceRole', ['ssm:GetParameter'], 'parameter/wobblio/config/dev/models');
    expectRolePolicyAllows(template, 'AgenticWorkerLambdaServiceRole', ['ssm:GetParameter'], 'parameter/wobblio/config/dev/features');
    expectRolePolicyAllows(template, 'AgenticWorkerLambdaServiceRole', ['sqs:ReceiveMessage'], 'WobblioAgenticQueue');
  });

  it('exports the agentic queue URL into the stage-scoped config namespace', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/wobblio/config/dev/queues/agentic_url',
    });
  });

  it('passes cdk-nag AwsSolutionsChecks with no un-suppressed errors', () => {
    const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    expect(errors.map((e) => e.entry.data)).toEqual([]);
  });
});
