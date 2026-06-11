import * as path from 'path';
import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ce from 'aws-cdk-lib/aws-ce';
import * as s3 from 'aws-cdk-lib/aws-s3';
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
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { WobblioDbStack } from './WobblioDbStack';
import { WobblioAuthStack } from './WobblioAuthStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioAppStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
  authStack: WobblioAuthStack;
}

export class WobblioAppStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioAppStackProps) {
    super(scope, id, props);

    const { config, dbStack, authStack } = props;

    // ── Shared DB connection env vars (resolved from SSM at deploy time) ─────
    const dbHost      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/endpoint');
    const dbPort      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/port');
    const dbSecretArn = ssm.StringParameter.valueForStringParameter(this, '/shared/db/wobblio/secret-arn');

    const commonLambdaEnv = {
      STAGE:        config.stage,
      DB_HOST:      dbHost,
      DB_PORT:      dbPort,
      DB_SECRET_ARN: dbSecretArn,
      KMS_KEY_ARN:  dbStack.kmsKey.keyArn,
    };

    // ── S3 Buckets ────────────────────────────────────────────────────────────

    // Access logs bucket (all other buckets log here)
    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      bucketName: config.resourceName('access-logs'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: config.resourceName('uploads'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'uploads/',
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: config.stage === 'prod'
            ? ['https://app.wobblio.com']
            : ['https://app.dev.wobblio.com', 'http://localhost:3000'],
          allowedHeaders: ['*'],
          maxAge: 300,
        },
      ],
      lifecycleRules: [
        {
          id: 'gdpr-18-month-delete',
          expiration: Duration.days(548),
          enabled: true,
        },
      ],
    });

    const exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: config.resourceName('exports'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'exports/',
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'gdpr-export-7-day-delete',
          expiration: Duration.days(7),
          enabled: true,
        },
      ],
    });

    const billingArchiveBucket = new s3.Bucket(this, 'BillingArchiveBucket', {
      bucketName: config.resourceName('billing-archive'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'billing-archive/',
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'stripe-7-year-retention',
          transitions: [
            {
              transitionAfter: Duration.days(90),
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
            },
          ],
          expiration: Duration.days(2555),
          enabled: true,
        },
      ],
    });

    const analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      bucketName: config.resourceName('analytics'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

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
      visibilityTimeout: Duration.seconds(30),
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

    // ── Lambda stubs ──────────────────────────────────────────────────────────
    // Lambdas run outside VPC — shared-infra DB SG allows off-VPC access (interim MVP posture).
    // VPC placement + custom SG is the target posture and will be added when traffic warrants it.

    const backendRoot = path.join(__dirname, '../../../../backend');

    const makeLambda = (
      handlerDir: string,
      concurrency: number,
      extraEnv: Record<string, string> = {},
    ): NodejsFunction =>
      new NodejsFunction(this, handlerDir, {
        entry: path.join(backendRoot, `src/handlers/${handlerDir}/index.ts`),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_24_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(30),
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

    const webAppUrl = ssm.StringParameter.valueForStringParameter(this, '/wobblio/config/web_app_url');

    const apiHandlerFn = makeLambda('api-handler', 25, {
      UPLOADS_BUCKET:  uploadsBucket.bucketName,
      EXPORTS_BUCKET:  exportsBucket.bucketName,
      INGEST_QUEUE_URL: ingestionQueue.queueUrl,
      BILLING_ARCHIVE_BUCKET: billingArchiveBucket.bucketName,
      WEB_APP_URL: webAppUrl,
    });

    const ingestionWorkerFn = makeLambda('ingestion-worker', 5, {
      UPLOADS_BUCKET: uploadsBucket.bucketName,
    });

    const cronBudgetResetFn    = makeLambda('cron-budget-reset', 2, { ANALYTICS_BUCKET: analyticsBucket.bucketName });
    const cronFxRateFetchFn    = makeLambda('cron-fx-rate-fetch', 2);
    const cronWaitlistReleaseFn = makeLambda('cron-waitlist-release', 2);

    // Public endpoints — no Cognito auth, called by unauthenticated landing-page visitors
    const waitlistStatusFn = makeLambda('waitlist-status', 5, {
      MAX_FREE_USERS: ssm.StringParameter.valueForStringParameter(
        this, '/wobblio/config/quotas/max_free_waitlist_cap',
      ),
    });
    const analyticsEventsFn = makeLambda('analytics-events', 5, {
      ANALYTICS_QUEUE_URL: analyticsEventsQueue.queueUrl,
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
    uploadsBucket.grantPut(apiHandlerFn);
    uploadsBucket.grantRead(ingestionWorkerFn);
    exportsBucket.grantReadWrite(apiHandlerFn);
    billingArchiveBucket.grantWrite(apiHandlerFn);
    analyticsBucket.grantWrite(cronBudgetResetFn);

    ingestionQueue.grantSendMessages(apiHandlerFn);
    ingestionQueue.grantConsumeMessages(ingestionWorkerFn);

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
    dbSecret.grantRead(waitlistStatusFn);

    // SSM: read shared DB connection parameters
    const ssmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
      ],
    });
    [apiHandlerFn, ingestionWorkerFn, cronBudgetResetFn, cronFxRateFetchFn, cronWaitlistReleaseFn, waitlistStatusFn]
      .forEach(fn => fn.addToRolePolicy(ssmPolicy));

    // SSM: waitlist cap — cron-waitlist-release and api-handler need this
    const waitlistCapSsmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wobblio/config/quotas/max_free_waitlist_cap`,
      ],
    });
    [apiHandlerFn, cronWaitlistReleaseFn].forEach(fn => fn.addToRolePolicy(waitlistCapSsmPolicy));

    // SSM: mock premium whitelist — api-handler reads at checkout time
    apiHandlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wobblio/config/billing/mock_premium_whitelist`,
      ],
    }));

    // SES: cron-waitlist-release sends waitlist release notification emails
    cronWaitlistReleaseFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
      }),
    );
    cronWaitlistReleaseFn.addEnvironment('SES_FROM_ADDRESS', 'noreply@wobblio.com');

    // Bedrock: ingestion worker calls foundation models (model IDs are runtime SSM values)
    ingestionWorkerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
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

    // Catch-all proxy for authenticated API routes — real routes added in later epics
    const proxyResource = api.root.addProxy({
      defaultIntegration: new apigw.LambdaIntegration(apiHandlerFn),
      anyMethod: true,
    });

    // ── API Custom Domain (api.wobblio.com) — skipped for local stage ────────
    if (!config.isLocal) {
      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: 'wobblio.com',
      });

      const apiCert = new acm.Certificate(this, 'ApiCertificate', {
        domainName: 'api.wobblio.com',
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      const apiCustomDomain = new apigw.DomainName(this, 'ApiCustomDomain', {
        domainName: 'api.wobblio.com',
        certificate: apiCert,
        endpointType: apigw.EndpointType.REGIONAL,
      });

      new apigw.BasePathMapping(this, 'ApiBasePathMapping', {
        domainName: apiCustomDomain,
        restApi: api,
        stage: api.deploymentStage,
      });

      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: hostedZone,
        recordName: 'api',
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayDomain(apiCustomDomain),
        ),
      });

      new CfnOutput(this, 'ApiUrl', { value: 'https://api.wobblio.com' });
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
    ) =>
      new events.Rule(this, id, {
        schedule,
        targets: [new targets.LambdaFunction(fn)],
        enabled: config.stage === 'prod',
      });

    makeCron(
      'BudgetResetCron',
      events.Schedule.cron({ minute: '0', hour: '0', weekDay: 'MON' }),
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

    const allLambdas = [
      apiHandlerFn, ingestionWorkerFn,
      cronBudgetResetFn, cronFxRateFetchFn, cronWaitlistReleaseFn,
      waitlistStatusFn, analyticsEventsFn,
    ];

    // ── SNS Ops Topic ─────────────────────────────────────────────────────────
    const opsEmail = ssm.StringParameter.valueForStringParameter(
      this,
      '/wobblio/config/ops/email',
    );

    const opsTopic = new sns.Topic(this, 'OpsAlarmTopic', {
      topicName: `wobblio-ops-${config.stage}`,
      masterKey: dbStack.kmsKey,
    });
    opsTopic.addSubscription(new subscriptions.EmailSubscription(opsEmail));

    new CfnOutput(this, 'OpsTopicArn', {
      value: opsTopic.topicArn,
      exportName: `wobblio-${config.stage}-ops-topic-arn`,
    });

    // ── Lambda log retention (2 days — MVP) ───────────────────────────────────
    allLambdas.forEach(fn =>
      new logs.LogRetention(this, `${fn.node.id}LogRetention`, {
        logGroupName: `/aws/lambda/${fn.functionName}`,
        retention: logs.RetentionDays.THREE_DAYS,
      }),
    );

    // ── AWS Budgets (€30/month, alert at 50%/80%/100%) ───────────────────────
    const buildBudgetNotification = (
      threshold: number,
    ): budgets.CfnBudget.NotificationWithSubscribersProperty => ({
      notification: {
        notificationType: 'FORECASTED',
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers: [{ subscriptionType: 'EMAIL', address: opsEmail }],
    });

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `wobblio-monthly-${config.stage}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 30, unit: 'USD' },
      },
      notificationsWithSubscribers: [50, 80, 100].map(buildBudgetNotification),
    });

    // ── Cost Anomaly Detection (alert >€10) ───────────────────────────────────
    const anomalyMonitor = new ce.CfnAnomalyMonitor(this, 'CostAnomalyMonitor', {
      monitorName: `wobblio-anomaly-${config.stage}`,
      monitorType: 'DIMENSIONAL',
      monitorDimension: 'SERVICE',
    });

    new ce.CfnAnomalySubscription(this, 'CostAnomalySubscription', {
      subscriptionName: `wobblio-anomaly-sub-${config.stage}`,
      monitorArnList: [anomalyMonitor.attrMonitorArn],
      subscribers: [{ address: opsEmail, type: 'EMAIL' }],
      threshold: 10,
      frequency: 'DAILY',
    });

    // ── cdk-nag suppressions ──────────────────────────────────────────────────

    // Access logs bucket cannot log to itself
    NagSuppressions.addResourceSuppressions(
      accessLogsBucket,
      [{ id: 'AwsSolutions-S1', reason: 'This is the access logs bucket itself' }],
    );

    // Analytics bucket: internal KPI Parquet data; access logging deferred to Epic 15
    NagSuppressions.addResourceSuppressions(analyticsBucket, [
      { id: 'AwsSolutions-S1', reason: 'Analytics bucket logs internal KPI data; access logging added in Epic 15 observability' },
    ]);

    // All Lambda functions: CDK auto-attaches AWSLambdaBasicExecutionRole (CloudWatch Logs only)
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

    // CDK standard S3 grant methods generate wildcard sub-actions (GetObject*, List*, etc.)
    // These are scoped to specific bucket ARNs — acceptable pattern
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
            `Resource::<UploadsBucket5E5E9B64.Arn>/*`,
            `Resource::<ExportsBucket5A12738B.Arn>/*`,
            `Resource::<BillingArchiveBucketC942022F.Arn>/*`,
            `Resource::<AnalyticsBucket39EAAEEA.Arn>/*`,
            // SSM path wildcard needed to read multiple /shared/db/* parameters
            `Resource::arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
          ],
        },
      ], true),
    );

    // SES identity wildcard is scoped to wobblio.com domain — required because CDK resolves the resource path dynamically
    NagSuppressions.addResourceSuppressions(cronWaitlistReleaseFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'SES identity/* wildcard is scoped to this account and region; specific domain identity cannot be referenced before DNS verification',
        appliesTo: [`Resource::arn:aws:ses:${this.region}:${this.account}:identity/*`],
      },
    ], true);

    // Bedrock: model IDs are runtime SSM values — wildcard scoped to foundation-model namespace
    NagSuppressions.addResourceSuppressions(ingestionWorkerFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Bedrock foundation-model/* wildcard: model IDs are runtime SSM values and cannot be enumerated at synth time',
        // cdk-nag uses the resolved region string in the finding path
        appliesTo: [`Resource::arn:aws:bedrock:${this.region}::foundation-model/*`],
      },
    ], true);

    // API Gateway: request validation deferred until real routes are defined (Epic 06+)
    NagSuppressions.addResourceSuppressions(api, [
      { id: 'AwsSolutions-APIG2', reason: 'Request validation deferred until real API routes are defined (Epic 06+)' },
    ], true);

    // Public API Gateway methods do not require authorization
    NagSuppressions.addResourceSuppressions(waitlistStatusMethod, [
      { id: 'AwsSolutions-COG4', reason: 'The waitlist status endpoint is public and does not require authentication' },
    ]);
    NagSuppressions.addResourceSuppressions(analyticsEventsMethod, [
      { id: 'AwsSolutions-COG4', reason: 'The analytics events endpoint is public and does not require authentication' },
    ]);

    // Analytics events SQS queue: KMS key applied; access limited to analyticsEventsFn
    NagSuppressions.addResourceSuppressions(analyticsEventsQueue, [
      { id: 'AwsSolutions-SQS3', reason: 'DLQ configured (analyticsEventsDlq)' },
    ]);
    NagSuppressions.addResourceSuppressions(analyticsEventsDlq, [
      { id: 'AwsSolutions-SQS3', reason: 'This is itself a DLQ; no further DLQ required' },
    ]);

    // analyticsEventsFn SQS send permission uses a wildcard on the queue resource
    NagSuppressions.addResourceSuppressions(analyticsEventsFn, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'CDK grantSendMessages generates standard SQS sub-action wildcards scoped to the analytics queue ARN',
        appliesTo: [
          'Action::sqs:GetQueue*',
          `Resource::<AnalyticsEventsQueue*.Arn>`,
        ],
      },
    ], true);

    // SNS ops topic: KMS key applied; SSL enforced by SNS default
    NagSuppressions.addResourceSuppressions(opsTopic, [
      { id: 'AwsSolutions-SNS2', reason: 'KMS encryption applied via masterKey prop' },
      { id: 'AwsSolutions-SNS3', reason: 'SNS enforces SSL in transit by default; no additional policy needed at MVP' },
    ]);

    // LogRetention custom resource Lambda is fully CDK-managed
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-L1', reason: 'LogRetention custom resource Lambda is CDK-managed; runtime not customer-controlled' },
      { id: 'AwsSolutions-IAM4', reason: 'LogRetention custom resource uses AWSLambdaBasicExecutionRole; CDK-managed' },
      { id: 'AwsSolutions-IAM5', reason: 'LogRetention custom resource requires wildcard log-group ARNs; CDK-managed pattern' },
    ]);

    // API Gateway CloudWatch role uses AmazonAPIGatewayPushToCloudWatchLogs — standard CDK default
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
    ]);

    applyWobblioTags(this, config);

    // Suppress unused variable warnings — proxyResource is a side-effect construct
    void proxyResource;
  }
}
