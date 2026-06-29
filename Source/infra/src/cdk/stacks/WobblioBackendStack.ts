import * as path from 'path';
import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as location from 'aws-cdk-lib/aws-location';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { configParamName } from '../config/appConfig';
import { WobblioDbStack } from './WobblioDbStack';
import { WobblioAuthStack } from './WobblioAuthStack';
import { WobblioStorageStack } from './WobblioStorageStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioBackendStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
  authStack: WobblioAuthStack;
  storageStack: WobblioStorageStack;
}

export class WobblioBackendStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioBackendStackProps) {
    super(scope, id, props);

    const { config, dbStack, authStack, storageStack } = props;

    // ── Shared DB connection env vars (resolved from SSM at deploy time) ─────
    const dbHost      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/endpoint');
    const dbPort      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/port');
    const dbSecretArn = ssm.StringParameter.valueForStringParameter(this, config.dbSecretParam);

    const commonLambdaEnv = {
      STAGE:        config.stage,
      // Stage-scopes /wobblio/config/* reads to /wobblio/config/<stage>/* (stageConfig).
      // dev and prod share the account, so each reads its own scoped config namespace.
      CONFIG_STAGE: config.stage,
      LOG_LEVEL:    config.logLevel,
      DB_HOST:      dbHost,
      DB_PORT:      dbPort,
      DB_SECRET_ARN: dbSecretArn,
      KMS_KEY_ARN:  dbStack.kmsKey.keyArn,
    };

    // ARN of a stage-scoped config param (or a wildcard suffix like 'models/*'), kept in
    // lock-step with the backend's stageConfig so every IAM grant matches the path read.
    const configParamArn = (relativeKeyOrGlob: string): string =>
      `arn:aws:ssm:${this.region}:${this.account}:parameter${configParamName(config.stage, relativeKeyOrGlob)}`;

    // ── SQS Queues ────────────────────────────────────────────────────────────
    const ingestionDlq = new sqs.Queue(this, 'IngestionDlq', {
      queueName: config.resourceName('ingestion-dlq'),
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dbStack.kmsKey,
      enforceSSL: true,
    });

    const ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      queueName: config.resourceName('ingestion'),
      // Must stay >= the ingestion-worker Lambda timeout (120s, raised for slow PDF/Sonnet
      // parses) so a message isn't redelivered while still being processed.
      visibilityTimeout: Duration.seconds(180),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dbStack.kmsKey,
      enforceSSL: true,
      deadLetterQueue: {
        queue: ingestionDlq,
        maxReceiveCount: 3,
      },
    });

    const analyticsEventsDlq = new sqs.Queue(this, 'AnalyticsEventsDlq', {
      queueName: config.resourceName('analytics-events-dlq'),
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dbStack.kmsKey,
      enforceSSL: true,
    });

    const analyticsEventsQueue = new sqs.Queue(this, 'AnalyticsEventsQueue', {
      queueName: config.resourceName('analytics-events'),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dbStack.kmsKey,
      enforceSSL: true,
      deadLetterQueue: {
        queue: analyticsEventsDlq,
        maxReceiveCount: 3,
      },
    });

    // ── Lambda functions ──────────────────────────────────────────────────────
    // Lambdas run outside VPC — shared-infra DB SG allows off-VPC access (interim MVP posture).
    // VPC placement + custom SG is the target posture and will be added when traffic warrants it.

    const backendRoot = path.join(__dirname, '../../../../backend');

    const makeLambda = (
      handlerDir: string,
      concurrency: number,
      extraEnv: Record<string, string> = {},
      timeoutSeconds = 30,
    ): NodejsFunction =>
      new NodejsFunction(this, handlerDir, {
        functionName: config.resourceName(handlerDir),
        entry: path.join(backendRoot, `src/handlers/${handlerDir}/index.ts`),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_24_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(timeoutSeconds),
        reservedConcurrentExecutions: concurrency,
        projectRoot: backendRoot,
        depsLockFilePath: path.join(backendRoot, 'package-lock.json'),
        bundling: {
          tsconfig: path.join(backendRoot, 'tsconfig.json'),
          externalModules: ['@aws-sdk/*'],
          minify: true,
        },
        environment: { ...commonLambdaEnv, ...extraEnv },
      });

    // Stage-correct webapp origin (app.wobblio.com | app.dev.wobblio.com), used to
    // build public share links (/r/<token>). Derived from config so it can't drift
    // from a hand-managed SSM param. BackendStack never deploys for local, so the
    // appDomain is always a real https host here.
    const webAppUrl = `https://${config.appDomain}`;

    // Reverse-geocodes upload coordinates for tier-2 invoice location (§6.5). Skipped
    // locally — LocalStack has no Location service, and the geocoder adapter degrades
    // to null (location falls back to the profile tier) when LOCATION_PLACE_INDEX is unset.
    const placeIndexName = config.resourceName('receipts-geo');
    const placeIndex = config.isLocal
      ? null
      : new location.CfnPlaceIndex(this, 'ReceiptsPlaceIndex', {
          dataSource: 'Esri',
          indexName: placeIndexName,
        });

    const apiHandlerFn = makeLambda('api-handler', 25, {
      UPLOADS_BUCKET:         storageStack.uploadsBucket.bucketName,
      EXPORTS_BUCKET:         storageStack.exportsBucket.bucketName,
      INGEST_QUEUE_URL:       ingestionQueue.queueUrl,
      BILLING_ARCHIVE_BUCKET: storageStack.billingArchiveBucket.bucketName,
      WEB_APP_URL:            webAppUrl,
      COGNITO_USER_POOL_ID:   authStack.userPool.userPoolId,
      ...(placeIndex ? { LOCATION_PLACE_INDEX: placeIndexName } : {}),
    });

    // Onboarding writes custom:onboarded + profile attributes back to Cognito.
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminUpdateUserAttributes'],
      resources: [authStack.userPool.userPoolArn],
    }));

    // Tier-2 reverse geocode: a single scoped action on this stack's place index only.
    if (placeIndex) {
      apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['geo:SearchPlaceIndexForPosition'],
        resources: [placeIndex.attrArn],
      }));
    }

    // 120s: PDF receipts parse on the document-capable insight model (Sonnet), a single
    // Converse call of ~20-25s (plus a possible schema retry) — well over the 30s default,
    // which timed PDFs out mid-pipeline and looped them in PROCESSING. Images (Qwen) are
    // far faster but share the worker. Queue visibilityTimeout above is kept >= this.
    const ingestionWorkerFn = makeLambda('ingestion-worker', 5, {
      UPLOADS_BUCKET: storageStack.uploadsBucket.bucketName,
    }, 120);

    const cronBudgetResetFn    = makeLambda('cron-budget-reset', 2, { ANALYTICS_BUCKET: storageStack.analyticsBucket.bucketName });
    const cronFxRateFetchFn    = makeLambda('cron-fx-rate-fetch', 2);
    const cronWaitlistReleaseFn = makeLambda('cron-waitlist-release', 2);
    const cronReleaseHeldLocationsFn = makeLambda('cron-release-held-locations', 2);
    // 300s safety-net: the advisor fans out one Bedrock call per eligible tenant
    // under a bounded promise pool; well above the 30s API budget but async (§10).
    const cronWeeklyAdvisorFn = makeLambda('cron-weekly-advisor', 2, {}, 300);

    // 120s: a single Logs Insights query (StartQuery + poll) over the prior day's
    // ingestion-worker logs, rolling per-status averages into kpi_daily (§ observability).
    const ingestionLogGroupName = `/aws/lambda/${ingestionWorkerFn.functionName}`;
    const cronIngestionMetricsRollupFn = makeLambda(
      'cron-ingestion-metrics-rollup', 2, { INGESTION_LOG_GROUP: ingestionLogGroupName }, 120,
    );

    // Data retention (cron-data-retention): purge old rows from notification, invoice_share,
    // household_invite, ingestion_ledger, quota_counter, weekly_advisor via SECURITY DEFINER
    // functions per retention policy. Dispatched by resource key in EventBridge input.
    const cronDataRetentionFn = makeLambda('cron-data-retention', 2);

    // Public endpoints — no Cognito auth, called by unauthenticated landing-page visitors
    const waitlistStatusFn = makeLambda('waitlist-status', 5, {
      MAX_FREE_USERS: ssm.StringParameter.valueForStringParameter(
        this, configParamName(config.stage, 'quotas/max_free_waitlist_cap'),
      ),
    });
    const analyticsEventsFn = makeLambda('analytics-events', 5, {
      ANALYTICS_QUEUE_URL: analyticsEventsQueue.queueUrl,
    });

    // Public read-only resolver for shared receipt links (/r/<token>). No Cognito
    // auth — the unguessable token is the only credential; resolves under the
    // invoice owner's RLS scope so a token exposes only its one invoice.
    const shareInvoiceFn = makeLambda('share-invoice', 5, {
      UPLOADS_BUCKET: storageStack.uploadsBucket.bucketName,
    });

    // ── SQS event source on ingestion worker ─────────────────────────────────
    ingestionWorkerFn.addEventSource(
      new SqsEventSource(ingestionQueue, {
        batchSize: 1,
        maxConcurrency: 5,
        reportBatchItemFailures: true,
      }),
    );

    // ── IAM grants (least-privilege) ──────────────────────────────────────────
    // api-handler PUTs (presign), reads (HeadObject on confirm + presignGet on
    // detail view), and deletes (delete invoice) uploaded receipts.
    storageStack.uploadsBucket.grantPut(apiHandlerFn);
    storageStack.uploadsBucket.grantRead(apiHandlerFn);
    storageStack.uploadsBucket.grantDelete(apiHandlerFn);
    storageStack.uploadsBucket.grantRead(ingestionWorkerFn);
    storageStack.uploadsBucket.grantRead(shareInvoiceFn);
    storageStack.exportsBucket.grantReadWrite(apiHandlerFn);
    storageStack.billingArchiveBucket.grantWrite(apiHandlerFn);
    storageStack.analyticsBucket.grantWrite(cronBudgetResetFn);

    ingestionQueue.grantSendMessages(apiHandlerFn);
    ingestionQueue.grantConsumeMessages(ingestionWorkerFn);

    // Admin DLQ panel (admin-console 05): the api-handler reads + deletes DLQ
    // messages and replays them onto the main queue (send grant above). No
    // SendMessage on the DLQ itself — least privilege.
    ingestionDlq.grantConsumeMessages(apiHandlerFn);
    apiHandlerFn.addEnvironment('INGEST_DLQ_URL', ingestionDlq.queueUrl);
    apiHandlerFn.addEnvironment('INGESTION_WORKER_LOG_GROUP', ingestionLogGroupName);

    // Admin Troubleshooting page: the api-handler reads worker logs (Logs Insights),
    // flips its log level live (Lambda env update — read-merge-write), snapshots
    // queue depth, and reads its error-rate metrics. Resource-scoped where the action
    // allows; '*' only for actions that do not support resource-level IAM.
    apiHandlerFn.addEnvironment('INGESTION_WORKER_FUNCTION_NAME', ingestionWorkerFn.functionName);
    ingestionQueue.grant(apiHandlerFn, 'sqs:GetQueueAttributes');
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:StartQuery'],
      resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:${ingestionLogGroupName}:*`],
    }));
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:GetQueryResults', 'logs:StopQuery', 'cloudwatch:GetMetricData'],
      resources: ['*'],
    }));
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:GetFunctionConfiguration', 'lambda:UpdateFunctionConfiguration'],
      resources: [ingestionWorkerFn.functionArn],
    }));
    NagSuppressions.addResourceSuppressions(apiHandlerFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'logs:GetQueryResults/StopQuery act on an ephemeral queryId and cloudwatch:GetMetricData has no resource-level form',
        appliesTo: ['Resource::*'],
      },
    ], true);

    dbStack.kmsKey.grantEncryptDecrypt(apiHandlerFn);
    dbStack.kmsKey.grantEncryptDecrypt(ingestionWorkerFn);
    dbStack.kmsKey.grantEncryptDecrypt(waitlistStatusFn);
    dbStack.kmsKey.grantEncryptDecrypt(analyticsEventsFn);

    analyticsEventsQueue.grantSendMessages(analyticsEventsFn);

    // Secrets Manager: read app DB credentials
    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'DbSecret',
      dbSecretArn,
    );
    dbSecret.grantRead(apiHandlerFn);
    dbSecret.grantRead(ingestionWorkerFn);
    dbSecret.grantRead(cronWaitlistReleaseFn);
    dbSecret.grantRead(cronReleaseHeldLocationsFn);
    dbSecret.grantRead(cronBudgetResetFn);
    dbSecret.grantRead(cronWeeklyAdvisorFn);
    dbSecret.grantRead(cronIngestionMetricsRollupFn);
    dbSecret.grantRead(cronDataRetentionFn);
    dbSecret.grantRead(waitlistStatusFn);
    dbSecret.grantRead(shareInvoiceFn);

    // Logs Insights: StartQuery is scoped to the worker log group; GetQueryResults and
    // StopQuery operate on an ephemeral queryId and do not support resource-level IAM,
    // so they require "*" (suppressed below).
    cronIngestionMetricsRollupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:StartQuery'],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:${ingestionLogGroupName}:*`,
      ],
    }));
    cronIngestionMetricsRollupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:GetQueryResults', 'logs:StopQuery'],
      resources: ['*'],
    }));
    NagSuppressions.addResourceSuppressions(cronIngestionMetricsRollupFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'logs:GetQueryResults/StopQuery act on an ephemeral queryId and do not support resource-level permissions',
        appliesTo: ['Resource::*'],
      },
    ], true);

    // SSM: read shared DB connection parameters
    const ssmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
      ],
    });
    [apiHandlerFn, ingestionWorkerFn, cronBudgetResetFn, cronFxRateFetchFn, cronWaitlistReleaseFn, cronReleaseHeldLocationsFn, cronWeeklyAdvisorFn, cronIngestionMetricsRollupFn, cronDataRetentionFn, waitlistStatusFn, shareInvoiceFn]
      .forEach(fn => fn.addToRolePolicy(ssmPolicy));

    // SSM: waitlist cap — cron-waitlist-release and api-handler need this
    const waitlistCapSsmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [configParamArn('quotas/max_free_waitlist_cap')],
    });
    [apiHandlerFn, cronWaitlistReleaseFn].forEach(fn => fn.addToRolePolicy(waitlistCapSsmPolicy));

    // SSM: system-fault alert threshold (§07.4) — api-handler reads it for the admin faults
    // view. Separate single GetParameter (not in the quota-cap batch) so it stays admin-only.
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [configParamArn('quotas/max_system_faults_per_week')],
    }));

    // SSM: per-role quota caps — api-handler reads these (batched GetParameters)
    // for the scan-quota check on /me/usage and presign. Must include GetParameters
    // (plural) since SsmUploadQuotaAdapter loads every cap in one call (so a missing
    // grant 403s the whole batch). Mirrors QUOTA_PARAMS in core/domain/quotaConfig.ts.
    const quotaCapPaths = [
      'household_uploads_per_week',
      // Credit cap = invoice limit × this (Non-Functional 02). The worker also reads it
      // to charge actual tokens; the api-handler for the presign burst projection.
      'average_tokens_per_invoice',
      // Per-upload size/page limits (§06): api-handler reads bytes caps at presign; the
      // worker reads all three for the worker-start size + PDF-page validation.
      'max_image_bytes',
      'max_pdf_bytes',
      'max_pdf_pages',
      // Failure-refund caps were decommissioned in 03 (success-only charging), so only the
      // per-role upload caps remain. Mirrors QUOTA_PARAMS in core/domain/quotaConfig.ts.
      ...['standard', 'premium', 'tester', 'admin'].map((r) => `${r}_uploads_per_week`),
    ];
    // The ingestion-worker resolves the same allowance to charge credits on success, so
    // it loads the whole quota batch too — a missing grant would roll the ingestion back.
    const quotaCapSsmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: quotaCapPaths.map((p) => configParamArn(`quotas/${p}`)),
    });
    [apiHandlerFn, ingestionWorkerFn].forEach((fn) => fn.addToRolePolicy(quotaCapSsmPolicy));

    // SSM: dynamic queue routing (Non-Functional 01/04) — api-handler reads the agentic
    // pipeline feature flag and the agentic queue URL (exported by WobblioAgenticPipelineStack)
    // at confirm time to pick the legacy vs agentic queue. Single batched GetParameters; both
    // enumerated (no wildcard) so cdk-nag IAM5 stays clean. Missing params fail-safe to legacy.
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        configParamArn('features/agentic_pipeline_enabled'),
        configParamArn('queues/agentic_url'),
      ],
    }));

    // SSM: admin pipeline toggle (Non-Functional 01/05) — the admin console writes the
    // agentic feature flag at runtime. Enumerated single-param PutParameter (the read is
    // already granted above) so cdk-nag IAM5 stays clean.
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:PutParameter'],
      resources: [configParamArn('features/agentic_pipeline_enabled')],
    }));

    // SSM: mock premium whitelist — api-handler reads at checkout time
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [configParamArn('billing/mock_premium_whitelist')],
    }));

    // SSM: split-route thresholds — api-handler reads these for the optimizer (batched)
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        configParamArn('routing/max_stores'),
        configParamArn('routing/min_split_saving_eur'),
      ],
    }));

    // SSM: admin parameter editor (admin-console 02) — read + write the allowlisted
    // tunables. Keys enumerated (no wildcard) to mirror the allowlist in
    // core/domain/adminTunables.ts and keep cdk-nag IAM5 clean. The admin adapter
    // stage-scopes these at runtime, so the grants are stage-scoped too.
    const adminTunableKeys = [
      'quotas/max_free_waitlist_cap',
      'routing/min_split_saving_eur',
      'routing/max_stores',
      'tags/vocabulary',
      'tags/dedicated_call_enabled',
      'models/limits/vision_parser_max_tokens',
      'models/limits/auxiliary_max_tokens',
      'models/limits/insight_max_tokens',
      'models/limits/embedder_max_tokens',
      // Per-role quota caps — editable on the admin quotas page (mirrors
      // QUOTA_PARAMS in core/domain/quotaConfig.ts).
      ...quotaCapPaths.map((p) => `quotas/${p}`),
    ];
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameters', 'ssm:PutParameter'],
      resources: adminTunableKeys.map((k) => configParamArn(k)),
    }));

    // SSM: admin model-swap matrix (admin-console 03) — read + write the model IDs.
    // Enumerated (no wildcard) to keep cdk-nag IAM5 clean. Mirror MODEL_ROLES in
    // core/ports/ai/IModelRegistry.ts — getAll() reads every role in one GetParameters
    // call, which is all-or-nothing on authorization, so a missing role 403s the matrix.
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameters', 'ssm:PutParameter'],
      resources: ['vision_parser', 'pdf_parser', 'auxiliary', 'insight', 'embedder'].map(
        (role) => configParamArn(`models/${role}`),
      ),
    }));

    // Cost Explorer: admin AI-spend "actual" view (admin-console 07) reads billed
    // Bedrock cost per model. ce:GetCostAndUsage has no resource-level permissions —
    // it only supports a "*" resource — so a matching IAM5 suppression is required.
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ce:GetCostAndUsage'],
      resources: ['*'],
    }));
    NagSuppressions.addResourceSuppressions(apiHandlerFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'ce:GetCostAndUsage does not support resource-level permissions; "*" is the only valid resource',
        appliesTo: ['Resource::*'],
      },
    ], true);

    // Bedrock InvokeModel via cross-region inference profiles needs the profile ARN AND
    // the underlying foundation models in every member region; model IDs are runtime SSM
    // values. None can be enumerated at synth time, so both are wildcards with a matching
    // IAM5 suppression — extracted here so the policy and its suppression never drift.
    const grantBedrockInference = (fn: lambda.Function): void => {
      const resources = [
        `arn:aws:bedrock:*::foundation-model/*`,
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
      ];
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources,
      }));
      NagSuppressions.addResourceSuppressions(fn, [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Bedrock foundation-model + inference-profile wildcards: model IDs are runtime SSM values, and cross-region inference profiles require foundation-model access in every member region — neither can be enumerated at synth time',
          appliesTo: resources.map((r) => `Resource::${r}`),
        },
      ], true);
    };

    // Weekly-advisor cron calls the Haiku-class auxiliary model (id from SSM); see
    // docs/amendments/2026-06-17-weekly-advisor-tier-and-concurrency.md.
    grantBedrockInference(cronWeeklyAdvisorFn);
    cronWeeklyAdvisorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [configParamArn('models/auxiliary')],
    }));

    // SES: cron-waitlist-release sends waitlist release notification emails
    cronWaitlistReleaseFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
      }),
    );
    cronWaitlistReleaseFn.addEnvironment('SES_FROM_ADDRESS', 'noreply@wobblio.com');

    // Ingestion worker invokes the vision/auxiliary/embedder models (ids from SSM).
    grantBedrockInference(ingestionWorkerFn);

    // SSM: ingestion worker resolves swappable model IDs (vision/auxiliary/embedder/insight)
    // and the per-tenant daily AI-spend cap at runtime, one GetParameter per param.
    ingestionWorkerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          configParamArn('models/*'),
          // Per-tenant daily AI-spend cap. Not yet routed through stageConfig (flat),
          // so this grant stays flat — see the stage-scoping follow-up.
          `arn:aws:ssm:${this.region}:${this.account}:parameter/wobblio/config/ai/*`,
        ],
      }),
    );

    // ── API Gateway ───────────────────────────────────────────────────────────
    const apiAccessLogGroup = new logs.LogGroup(this, 'ApiGwAccessLogs', {
      retention: logs.RetentionDays.THREE_DAYS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'JwtAuthorizer', {
      cognitoUserPools: [authStack.userPool],
      authorizerName: 'cognito-jwt',
      identitySource: 'method.request.header.Authorization',
    });

    const api = new apigw.RestApi(this, 'WobblioApi', {
      restApiName: config.resourceName('api'),
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      },
      deployOptions: {
        stageName: config.stage,
        throttlingBurstLimit: 50,
        throttlingRateLimit: 20,
        loggingLevel: apigw.MethodLoggingLevel.ERROR,
        accessLogDestination: new apigw.LogGroupLogDestination(apiAccessLogGroup),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
        tracingEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    // Public routes — no Cognito auth (called by unauthenticated landing-page visitors)
    const waitlistResource = api.root.addResource('waitlist').addResource('status');
    const waitlistStatusMethod = waitlistResource.addMethod('GET', new apigw.LambdaIntegration(waitlistStatusFn), {
      authorizationType: apigw.AuthorizationType.NONE,
      authorizer: undefined,
    });

    const analyticsResource = api.root.addResource('analytics').addResource('events');
    const analyticsEventsMethod = analyticsResource.addMethod('POST', new apigw.LambdaIntegration(analyticsEventsFn), {
      authorizationType: apigw.AuthorizationType.NONE,
      authorizer: undefined,
    });

    // Public shared-receipt resolver — token-gated, no Cognito (see shareInvoiceFn).
    const sharedInvoiceResource = api.root.addResource('shared-invoices').addResource('{token}');
    const sharedInvoiceMethod = sharedInvoiceResource.addMethod('GET', new apigw.LambdaIntegration(shareInvoiceFn), {
      authorizationType: apigw.AuthorizationType.NONE,
      authorizer: undefined,
    });

    // Catch-all proxy for authenticated API routes — real routes added in later epics
    const proxyResource = api.root.addProxy({
      defaultIntegration: new apigw.LambdaIntegration(apiHandlerFn),
      anyMethod: true,
    });

    // ── API Custom Domain (api.wobblio.com) — skipped for local stage ────────
    if (!config.isLocal) {
      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: config.zoneDomain,
      });

      const apiCert = new acm.Certificate(this, 'ApiCertificate', {
        domainName: config.apiDomain,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      const apiCustomDomain = new apigw.DomainName(this, 'ApiCustomDomain', {
        domainName: config.apiDomain,
        certificate: apiCert,
        endpointType: apigw.EndpointType.REGIONAL,
      });

      new apigw.BasePathMapping(this, 'ApiBasePathMapping', {
        domainName: apiCustomDomain,
        restApi: api,
        stage: api.deploymentStage,
      });

      // recordName is the part before .wobblio.com: 'api' (prod) | 'api.dev' (dev)
      const apiRecordName = config.apiDomain.replace(`.${config.zoneDomain}`, '');
      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: hostedZone,
        recordName: apiRecordName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayDomain(apiCustomDomain),
        ),
      });
    }

    // ── SNS Platform Applications ─────────────────────────────────────────────
    // SNS mobile push platform applications (FCM, APNs) cannot be created via
    // CloudFormation. Create them once via AWS CLI after credentials are in SSM:
    //
    // FCM:
    //   aws sns create-platform-application \
    //     --name wobblio-fcm-{stage} --platform GCM \
    //     --attributes PlatformCredential=$(aws ssm get-parameter \
    //       --name /wobblio/config/fcm/server_key --query Parameter.Value --output text)
    //
    // APNs (sandbox for dev, APNS for prod):
    //   aws sns create-platform-application \
    //     --name wobblio-apns-{stage} --platform APNS_SANDBOX \
    //     --attributes PlatformCredential=<pem>,PlatformPrincipal=<cert>
    //
    // Store the returned PlatformApplicationArn in SSM for Lambda use.

    // ── SES Domain Identity ───────────────────────────────────────────────────
    new ses.EmailIdentity(this, 'SesIdentity', {
      identity: ses.Identity.domain('wobblio.com'),
      dkimSigning: true,
    });

    // ── EventBridge Cron Rules ────────────────────────────────────────────────
    // Disabled in non-prod to avoid accidental runs against shared DB
    const makeCron = (
      id: string,
      schedule: events.Schedule,
      fn: lambda.Function,
      // Defaults to prod-only; pass true to run in every stage (e.g. the KPI roll-up,
      // which the dev admin dashboard needs to have any data to show).
      enabled: boolean = config.stage === 'prod',
    ) =>
      new events.Rule(this, id, {
        schedule,
        targets: [new targets.LambdaFunction(fn)],
        enabled,
      });

    // Nightly: recompute budget accumulation, fire 85%/100% alerts, roll periods
    // over, and purge expired notifications (§10 budget-recycler).
    makeCron(
      'BudgetResetCron',
      events.Schedule.cron({ minute: '0', hour: '2' }),
      cronBudgetResetFn,
    );

    makeCron(
      'FxRateFetchCron',
      events.Schedule.cron({ minute: '5', hour: '6' }),
      cronFxRateFetchFn,
    );

    makeCron(
      'WaitlistReleaseCron',
      events.Schedule.cron({ minute: '0', hour: '8', weekDay: 'MON' }),
      cronWaitlistReleaseFn,
    );

    // Weekly, after reference-data updates land: release HELD_UNMAPPED invoices whose
    // region is now mapped so their deferred price observations aren't stranded (§6.5).
    makeCron(
      'ReleaseHeldLocationsCron',
      events.Schedule.cron({ minute: '30', hour: '7', weekDay: 'MON' }),
      cronReleaseHeldLocationsFn,
    );

    // Weekly (Sunday night): one insight-model savings summary per active Premium
    // user with recent activity (§10 weekly AI savings advisor).
    makeCron(
      'WeeklyAdvisorCron',
      events.Schedule.cron({ minute: '0', hour: '22', weekDay: 'SUN' }),
      cronWeeklyAdvisorFn,
    );

    // Hourly (at :30): roll yesterday + today into kpi_daily so the admin dashboard
    // stays near-current (the handler upserts, so each run finalizes the figures).
    makeCron(
      'IngestionMetricsRollupCron',
      events.Schedule.cron({ minute: '30' }),
      cronIngestionMetricsRollupFn,
      true, // always on: the admin KPI dashboard reads kpi_daily in every stage
    );

    // Data retention cleanup: staggered daily starting at 03:00 UTC.
    // Each rule passes a { resource: string } input to dispatch by table.
    const retentionSchedules = [
      { id: 'Notification',     resource: 'notification',      minute: '0',  hour: '3' },
      { id: 'InvoiceShare',     resource: 'invoice_share',     minute: '5',  hour: '3' },
      { id: 'HouseholdInvite',  resource: 'household_invite',  minute: '10', hour: '3' },
      { id: 'IngestionLedger',  resource: 'ingestion_ledger',  minute: '15', hour: '3' },
      { id: 'QuotaCounter',     resource: 'quota_counter',     minute: '20', hour: '3' },
      { id: 'WeeklyAdvisor',    resource: 'weekly_advisor',    minute: '25', hour: '3' },
    ];

    for (const s of retentionSchedules) {
      new events.Rule(this, `DataRetention${s.id}Cron`, {
        schedule: events.Schedule.cron({ minute: s.minute, hour: s.hour }),
        enabled: config.stage === 'prod',
        targets: [new targets.LambdaFunction(cronDataRetentionFn, {
          event: events.RuleTargetInput.fromObject({ resource: s.resource }),
        })],
      });
    }

    // Stuck-invoice reaper: flip invoices wedged in PROCESSING (worker timeout/crash/lost
    // message) to terminal FAILED_PROCESSING so they surface as failed and become deletable.
    // Hourly and enabled in every stage — unlike the daily retention sweeps, a stuck invoice
    // blocks the user's own delete, so it must clear quickly regardless of environment.
    new events.Rule(this, 'FailStuckInvoicesCron', {
      schedule: events.Schedule.rate(Duration.hours(1)),
      targets: [new targets.LambdaFunction(cronDataRetentionFn, {
        event: events.RuleTargetInput.fromObject({ resource: 'stuck_invoice' }),
      })],
    });

    const allLambdas = [
      apiHandlerFn, ingestionWorkerFn,
      cronBudgetResetFn, cronFxRateFetchFn, cronWaitlistReleaseFn, cronReleaseHeldLocationsFn,
      cronWeeklyAdvisorFn, cronIngestionMetricsRollupFn, cronDataRetentionFn, waitlistStatusFn, analyticsEventsFn, shareInvoiceFn,
    ];

    // ── Lambda log retention ──────────────────────────────────────────────────
    // The ingestion worker keeps 7 days so the daily kpi_daily roll-up has a debug
    // window beyond the 24h it actually queries; everything else stays at 3 days.
    allLambdas.forEach(fn =>
      new logs.LogRetention(this, `${fn.node.id}LogRetention`, {
        logGroupName: `/aws/lambda/${fn.functionName}`,
        retention: fn === ingestionWorkerFn ? logs.RetentionDays.ONE_WEEK : logs.RetentionDays.THREE_DAYS,
      }),
    );

    // ── cdk-nag suppressions ──────────────────────────────────────────────────

    allLambdas.forEach(fn =>
      NagSuppressions.addResourceSuppressions(fn, [
        {
          id: 'AwsSolutions-L1',
          reason: 'Node 24 is current LTS; cdk-nag rule may flag it pending rule update',
        },
        {
          id: 'AwsSolutions-IAM4',
          reason: 'AWSLambdaBasicExecutionRole is the minimal policy required for Lambda CloudWatch Logs; acceptable for MVP',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
        },
      ], true),
    );

    allLambdas.forEach(fn =>
      NagSuppressions.addResourceSuppressions(fn, [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'CDK grant* methods generate standard S3/KMS sub-action wildcards scoped to specific resource ARNs',
          appliesTo: [
            'Action::s3:GetObject*',
            'Action::s3:GetBucket*',
            'Action::s3:List*',
            'Action::s3:DeleteObject*',
            'Action::s3:Abort*',
            'Action::kms:GenerateDataKey*',
            'Action::kms:ReEncrypt*',
            // SSM path wildcard needed to read multiple /shared/db/* parameters
            `Resource::arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
          ],
        },
      ], true),
    );

    NagSuppressions.addResourceSuppressions(cronWaitlistReleaseFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'SES identity/* wildcard is scoped to this account and region; specific domain identity cannot be referenced before DNS verification',
        appliesTo: [`Resource::arn:aws:ses:${this.region}:${this.account}:identity/*`],
      },
    ], true);

    NagSuppressions.addResourceSuppressions(api, [
      { id: 'AwsSolutions-APIG2', reason: 'Request validation deferred until real API routes are defined (Epic 06+)' },
    ], true);

    NagSuppressions.addResourceSuppressions(waitlistStatusMethod, [
      { id: 'AwsSolutions-COG4', reason: 'The waitlist status endpoint is public and does not require authentication' },
    ]);
    NagSuppressions.addResourceSuppressions(analyticsEventsMethod, [
      { id: 'AwsSolutions-COG4', reason: 'The analytics events endpoint is public and does not require authentication' },
    ]);
    NagSuppressions.addResourceSuppressions(sharedInvoiceMethod, [
      { id: 'AwsSolutions-COG4', reason: 'The shared-invoice resolver is public by design; the unguessable share token is the credential' },
    ]);

    NagSuppressions.addResourceSuppressions(analyticsEventsQueue, [
      { id: 'AwsSolutions-SQS3', reason: 'DLQ configured (analyticsEventsDlq)' },
    ]);
    NagSuppressions.addResourceSuppressions(analyticsEventsDlq, [
      { id: 'AwsSolutions-SQS3', reason: 'This is itself a DLQ; no further DLQ required' },
    ]);

    NagSuppressions.addResourceSuppressions(analyticsEventsFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'CDK grantSendMessages generates standard SQS sub-action wildcards scoped to the analytics queue ARN',
        appliesTo: [
          'Action::sqs:GetQueue*',
        ],
      },
    ], true);

    NagSuppressions.addResourceSuppressions(api, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AmazonAPIGatewayPushToCloudWatchLogs is the standard CDK-managed policy for APIGW log delivery',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'],
      },
    ], true);

    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-APIG4',
        reason: 'CORS preflight OPTIONS methods must be unauthenticated by design',
      },
      {
        id: 'AwsSolutions-APIG3',
        reason: 'WAF integration deferred to Epic 12 security controls',
      },
      { id: 'AwsSolutions-L1', reason: 'LogRetention custom resource Lambda is CDK-managed; runtime not customer-controlled' },
      { id: 'AwsSolutions-IAM4', reason: 'LogRetention custom resource uses AWSLambdaBasicExecutionRole; CDK-managed' },
      { id: 'AwsSolutions-IAM5', reason: 'LogRetention custom resource requires wildcard log-group ARNs; CDK-managed pattern' },
    ]);

    applyWobblioTags(this, config);

    // Suppress unused variable warning — proxyResource is a side-effect construct
    void proxyResource;
  }
}
