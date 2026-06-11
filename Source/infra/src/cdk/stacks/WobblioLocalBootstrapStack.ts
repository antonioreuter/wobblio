import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy, SecretValue, BootstraplessSynthesizer } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';

interface WobblioLocalBootstrapStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class WobblioLocalBootstrapStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioLocalBootstrapStackProps) {
    super(scope, id, {
      ...props,
      // BootstraplessSynthesizer skips the CDK bootstrap version check and
      // avoids uploading Lambda assets to S3 — required for LocalStack.
      synthesizer: new BootstraplessSynthesizer(),
    });

    const { config } = props;

    // ── S3 Buckets ────────────────────────────────────────────────────────────
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: config.resourceName('uploads'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
          allowedHeaders: ['*'],
          maxAge: 300,
        },
      ],
    });

    const exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: config.resourceName('exports'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const billingArchiveBucket = new s3.Bucket(this, 'BillingArchiveBucket', {
      bucketName: config.resourceName('billing-archive'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      bucketName: config.resourceName('analytics'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ── SQS Queues ────────────────────────────────────────────────────────────
    const ingestionDlq = new sqs.Queue(this, 'IngestionDlq', {
      queueName: config.resourceName('ingestion-dlq'),
      retentionPeriod: Duration.days(14),
    });

    const ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      queueName: config.resourceName('ingestion'),
      visibilityTimeout: Duration.seconds(30),
      deadLetterQueue: {
        queue: ingestionDlq,
        maxReceiveCount: 3,
      },
    });

    // ── SSM Parameters ────────────────────────────────────────────────────────
    const modelParams: Record<string, string> = {
      '/wobblio/config/models/vision_parser': 'mock-vision-model',
      '/wobblio/config/models/auxiliary': 'mock-auxiliary-model',
      '/wobblio/config/models/embedder': 'mock-embedder-model',
      '/wobblio/config/models/insight': 'mock-insight-model',
    };

    const quotaParams: Record<string, string> = {
      '/wobblio/config/quotas/standard_uploads_per_week': '3',
      '/wobblio/config/quotas/premium_uploads_per_week': '10',
      '/wobblio/config/quotas/household_uploads_per_week': '20',
      '/wobblio/config/quotas/max_free_waitlist_cap': '5000',
    };

    const routingParams: Record<string, string> = {
      '/wobblio/config/routing/max_stores': '3',
      '/wobblio/config/routing/min_split_saving_eur': '5.00',
    };

    const tagParams: Record<string, string> = {
      '/wobblio/config/tags/dedicated_call_enabled': 'false',
      '/wobblio/config/tags/vocabulary': '[]',
    };

    const observabilityParams: Record<string, string> = {
      '/wobblio/config/ai/daily_spend_cap': '0.10',
      '/wobblio/config/ops/email': 'antonioreuter@gmail.com',
    };

    const allParams = { ...modelParams, ...quotaParams, ...routingParams, ...tagParams, ...observabilityParams };

    for (const [name, value] of Object.entries(allParams)) {
      new ssm.StringParameter(this, `Param${name.replace(/\//g, '-').replace(/^-/, '')}`, {
        parameterName: name,
        stringValue: value,
      });
    }

    // ── Secrets Manager ───────────────────────────────────────────────────────
    new secretsmanager.Secret(this, 'DbCredentials', {
      secretName: 'wobblio/local/db-credentials',
      secretStringValue: SecretValue.unsafePlainText(
        JSON.stringify({
          username: 'wobblio_dev',
          password: 'wobblio_dev_secret',
          host: 'postgres',
          port: 5432,
          dbname: 'wobblio_local',
        })
      ),
    });

    new secretsmanager.Secret(this, 'StripeCredentials', {
      secretName: 'wobblio/local/stripe',
      secretStringValue: SecretValue.unsafePlainText(
        JSON.stringify({
          secretKey: 'sk_test_mock_local',
          webhookSecret: 'whsec_mock_local',
        })
      ),
    });

    // ── CfnOutputs ────────────────────────────────────────────────────────────
    new CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new CfnOutput(this, 'ExportsBucketName', { value: exportsBucket.bucketName });
    new CfnOutput(this, 'BillingArchiveBucketName', { value: billingArchiveBucket.bucketName });
    new CfnOutput(this, 'AnalyticsBucketName', { value: analyticsBucket.bucketName });
    new CfnOutput(this, 'IngestionQueueUrl', { value: ingestionQueue.queueUrl });
    new CfnOutput(this, 'IngestionDlqUrl', { value: ingestionDlq.queueUrl });

    // ── cdk-nag suppressions (local only — not applicable to LocalStack mock) ─
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Local development only — LocalStack does not support S3 server access logging',
      },
      {
        id: 'AwsSolutions-S10',
        reason: 'Local development only — LocalStack S3 mock does not enforce SSL',
      },
      {
        id: 'AwsSolutions-SMG4',
        reason: 'Local development only — secret rotation not applicable to LocalStack',
      },
      {
        id: 'AwsSolutions-SQS3',
        reason: 'Local development only — DLQ does not need its own DLQ',
      },
      {
        id: 'AwsSolutions-SQS4',
        reason: 'Local development only — SSL not enforced on LocalStack SQS',
      },
    ]);
  }
}
