import * as path from 'path';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { configParamName } from '../config/appConfig';
import { WobblioDbStack } from './WobblioDbStack';
import { WobblioStorageStack } from './WobblioStorageStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioDataAiPipelineStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
  storageStack: WobblioStorageStack;
}

// Dedicated data-AI-pipeline stack (Non-Functional 01): isolates the agentic ingestion
// compute + queue from WobblioBackendStack so the pipeline owns its own CloudFormation
// stack and dependency surface. The agentic queue receives no traffic until dynamic
// routing (04) flips the feature flag — so this stack can be (re)deployed independently
// without affecting the live legacy ingestion path in WobblioBackendStack.
export class WobblioDataAiPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioDataAiPipelineStackProps) {
    super(scope, id, props);

    const { config, dbStack, storageStack } = props;

    // ── Shared DB connection env (resolved from SSM at deploy time, same as backend) ──
    const dbHost      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/endpoint');
    const dbPort      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/port');
    const dbSecretArn = ssm.StringParameter.valueForStringParameter(this, config.dbSecretParam);

    const commonLambdaEnv = {
      STAGE:         config.stage,
      CONFIG_STAGE:  config.stage,
      LOG_LEVEL:     config.logLevel,
      DB_HOST:       dbHost,
      DB_PORT:       dbPort,
      DB_SECRET_ARN: dbSecretArn,
      KMS_KEY_ARN:   dbStack.kmsKey.keyArn,
    };

    // ARN of a stage-scoped config param (or a wildcard suffix like 'models/*'), kept in
    // lock-step with the backend's stageConfig so every IAM grant matches the path read.
    const configParamArn = (relativeKeyOrGlob: string): string =>
      `arn:aws:ssm:${this.region}:${this.account}:parameter${configParamName(config.stage, relativeKeyOrGlob)}`;

    // ── Queue + DLQ ─────────────────────────────────────────────────────────────
    const agenticDlq = new sqs.Queue(this, 'WobblioAgenticDLQ', {
      queueName: config.resourceName('agentic-dlq'),
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dbStack.kmsKey,
      enforceSSL: true,
    });

    const agenticQueue = new sqs.Queue(this, 'WobblioAgenticQueue', {
      queueName: config.resourceName('agentic'),
      // Headroom over the worker Lambda timeout (300s): an equal value lets a message
      // become visible at the same instant a full-300s agent run is committing, racing a
      // redelivery. 360s keeps the in-flight run exclusive (mirrors the ingestion queue's
      // 180s-over-120s margin).
      visibilityTimeout: Duration.seconds(360),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dbStack.kmsKey,
      enforceSSL: true,
      deadLetterQueue: {
        queue: agenticDlq,
        maxReceiveCount: 3,
      },
    });

    // Any message landing in the DLQ is a stuck agent run worth a look. Alarm on the
    // first visible message sustained for 5 minutes (1 × 5-min period).
    new cloudwatch.Alarm(this, 'WobblioAgenticDLQNotEmptyAlarm', {
      alarmName: config.resourceName('agentic-dlq-not-empty'),
      alarmDescription: 'Agentic ingestion DLQ has visible messages (failed agent runs)',
      metric: agenticDlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ── Worker Lambda (skeleton; agent logic in 03) ──────────────────────────────
    // Runs outside VPC — the shared-infra DB SG allows off-VPC access (interim MVP
    // posture, matching the backend stack). VPC placement is the target posture.
    const backendRoot = path.join(__dirname, '../../../../backend');

    const agenticWorkerFn = new NodejsFunction(this, 'WobblioAgenticWorkerLambda', {
      functionName: config.resourceName('agentic-worker'),
      entry: path.join(backendRoot, 'src/handlers/agentic-worker/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(300),
      reservedConcurrentExecutions: 5,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, 'package-lock.json'),
      bundling: {
        tsconfig: path.join(backendRoot, 'tsconfig.json'),
        externalModules: ['@aws-sdk/*'],
        minify: true,
      },
      environment: {
        ...commonLambdaEnv,
        UPLOADS_BUCKET: storageStack.uploadsBucket.bucketName,
      },
    });

    agenticWorkerFn.addEventSource(
      new SqsEventSource(agenticQueue, {
        batchSize: 1,
        maxConcurrency: 5,
        reportBatchItemFailures: true,
      }),
    );

    // ── IAM least-privilege (mirrors the ingestion worker) ───────────────────────
    agenticQueue.grantConsumeMessages(agenticWorkerFn);
    storageStack.uploadsBucket.grantRead(agenticWorkerFn);
    dbStack.kmsKey.grantEncryptDecrypt(agenticWorkerFn);

    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', dbSecretArn);
    dbSecret.grantRead(agenticWorkerFn);

    // SSM: shared DB connection params.
    agenticWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`],
    }));

    // SSM: swappable model IDs, tag vocabulary, pipeline feature flags, upload quotas, and the
    // vision-escalation thresholds the agent reads at runtime — scoped to the config sub-trees per
    // spec §3 (stage-scoped). quotas/* was missing: assertUploadWithinLimits reads
    // quotas/household_uploads_per_week, which AccessDenied'd every agentic-routed message.
    // ingestion/* was missing: SsmEscalationConfigAdapter reads ingestion/vision_escalation, which
    // AccessDenied'd (swallowed) → the ladder silently ran on hard-coded defaults (fix 11 review ⑥).
    agenticWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        configParamArn('models/*'),
        configParamArn('tags/*'),
        configParamArn('features/*'),
        configParamArn('quotas/*'),
        configParamArn('ingestion/*'),
      ],
    }));

    // Bedrock InvokeModel via cross-region inference profiles needs the profile ARN AND the
    // underlying foundation models in every member region; model IDs are runtime SSM values.
    // None can be enumerated at synth time, so both are wildcards with a matching suppression.
    const bedrockResources = [
      `arn:aws:bedrock:*::foundation-model/*`,
      `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
    ];
    agenticWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: bedrockResources,
    }));

    // SSM: device push platform ARNs (16f) — the worker reads the FCM/APNs platform-app ARNs to
    // publish terminal-status pushes. Enumerated (no wildcard) so cdk-nag IAM5 stays clean; a
    // missing param means that platform is unconfigured and is skipped (best-effort, no delivery).
    agenticWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        configParamArn('push/fcm_platform_arn'),
        configParamArn('push/apns_platform_arn'),
      ],
    }));

    // SNS: device push (16f). Platform apps are created out-of-band (their ARNs aren't known at
    // synth), so scope to this account+region's app/* + endpoint/* with a matching suppression.
    const snsPushResources = [
      `arn:aws:sns:${this.region}:${this.account}:app/*`,
      `arn:aws:sns:${this.region}:${this.account}:endpoint/*`,
    ];
    agenticWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:CreatePlatformEndpoint', 'sns:Publish'],
      resources: snsPushResources,
    }));

    // ── Cross-stack export: agentic queue/DLQ URLs ───────────────────────────────
    // Written into the stage-scoped config namespace so the backend (routing adapter, 04, and
    // the admin Troubleshooting page) reads them without a hard CDK dependency from
    // WobblioBackendStack onto this stack (WobblioBackendStack is instantiated first).
    new ssm.StringParameter(this, 'WobblioAgenticQueueUrlParam', {
      parameterName: configParamName(config.stage, 'queues/agentic_url'),
      stringValue: agenticQueue.queueUrl,
      description: 'URL of the agentic ingestion queue (consumed by the dynamic routing adapter, 04)',
    });
    new ssm.StringParameter(this, 'WobblioAgenticDlqUrlParam', {
      parameterName: configParamName(config.stage, 'queues/agentic_dlq_url'),
      stringValue: agenticDlq.queueUrl,
      description: 'URL of the agentic DLQ (consumed by the admin Troubleshooting page)',
    });

    // ── Log retention ─────────────────────────────────────────────────────────────
    new logs.LogRetention(this, 'WobblioAgenticWorkerLogRetention', {
      logGroupName: `/aws/lambda/${agenticWorkerFn.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // ── cdk-nag suppressions ──────────────────────────────────────────────────────
    NagSuppressions.addResourceSuppressions(agenticWorkerFn, [
      {
        id: 'AwsSolutions-L1',
        reason: 'Node 24 is current LTS; cdk-nag rule may flag it pending rule update',
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWSLambdaBasicExecutionRole is the minimal policy required for Lambda CloudWatch Logs; acceptable for MVP',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'CDK grant* methods generate standard S3/KMS/SQS sub-action wildcards scoped to specific resource ARNs',
        appliesTo: [
          'Action::s3:GetObject*',
          'Action::s3:GetBucket*',
          'Action::s3:List*',
          'Action::kms:GenerateDataKey*',
          'Action::kms:ReEncrypt*',
          `Resource::arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
        ],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Bedrock foundation-model + inference-profile wildcards: model IDs are runtime SSM values, and cross-region inference profiles require foundation-model access in every member region — neither can be enumerated at synth time',
        appliesTo: bedrockResources.map((r) => `Resource::${r}`),
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Scoped SSM config sub-trees (models/tags/features/quotas) are read all-or-nothing per role; model/tag/flag/quota keys are runtime values that cannot be enumerated at synth time',
        appliesTo: [
          `Resource::${configParamArn('models/*')}`,
          `Resource::${configParamArn('tags/*')}`,
          `Resource::${configParamArn('features/*')}`,
          `Resource::${configParamArn('quotas/*')}`,
        ],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'SNS platform applications + their device endpoints are created out-of-band (cannot be made via CloudFormation); their ARNs are not known at synth, so the grant is scoped to this account+region\'s app/* and endpoint/* only',
        appliesTo: snsPushResources.map((r) => `Resource::${r}`),
      },
    ], true);

    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-L1', reason: 'LogRetention custom resource Lambda is CDK-managed; runtime not customer-controlled' },
      { id: 'AwsSolutions-IAM4', reason: 'LogRetention custom resource uses AWSLambdaBasicExecutionRole; CDK-managed' },
      { id: 'AwsSolutions-IAM5', reason: 'LogRetention custom resource requires wildcard log-group ARNs; CDK-managed pattern' },
    ]);

    applyWobblioTags(this, config);
  }
}
