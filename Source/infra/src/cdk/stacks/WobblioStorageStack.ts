import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { WobblioDbStack } from './WobblioDbStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioStorageStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
}

export class WobblioStorageStack extends Stack {
  readonly uploadsBucket: s3.Bucket;
  readonly exportsBucket: s3.Bucket;
  readonly billingArchiveBucket: s3.Bucket;
  readonly analyticsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: WobblioStorageStackProps) {
    super(scope, id, props);

    const { config, dbStack } = props;

    this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: config.resourceName('uploads'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      cors: [
        {
          // Uploads are presigned multipart POST with content-length-range (§06). The
          // presigned-PUT path was removed, so POST is the only method clients use.
          allowedMethods: [s3.HttpMethods.POST],
          allowedOrigins: config.isLocal
            ? ['http://localhost:3000', 'http://localhost:3001']
            : [`https://${config.appDomain}`],
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

    this.exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: config.resourceName('exports'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'gdpr-export-7-day-delete',
          expiration: Duration.days(7),
          enabled: true,
        },
      ],
    });

    this.billingArchiveBucket = new s3.Bucket(this, 'BillingArchiveBucket', {
      bucketName: config.resourceName('billing-archive'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
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

    this.analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      bucketName: config.resourceName('analytics'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dbStack.kmsKey,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Analytics bucket: internal KPI Parquet data; access logging deferred to Epic 15
    NagSuppressions.addResourceSuppressions(this.analyticsBucket, [
      { id: 'AwsSolutions-S1', reason: 'Analytics bucket stores internal KPI data; access logging added in Epic 15 observability' },
    ]);

    // All buckets: no access log bucket — S3 server access logging deferred to Epic 15
    NagSuppressions.addResourceSuppressions(this.uploadsBucket, [
      { id: 'AwsSolutions-S1', reason: 'S3 server access logging deferred to Epic 15 observability' },
    ]);
    NagSuppressions.addResourceSuppressions(this.exportsBucket, [
      { id: 'AwsSolutions-S1', reason: 'S3 server access logging deferred to Epic 15 observability' },
    ]);
    NagSuppressions.addResourceSuppressions(this.billingArchiveBucket, [
      { id: 'AwsSolutions-S1', reason: 'S3 server access logging deferred to Epic 15 observability' },
    ]);

    applyWobblioTags(this, config);
  }
}
