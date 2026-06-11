import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioDbStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class WobblioDbStack extends Stack {
  readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: WobblioDbStackProps) {
    super(scope, id, props);

    const { config } = props;

    // KMS CMK for application-level AES-GCM envelope encryption.
    // Scope: participant_name_enc, comment_enc, export_s3_key, personal notes.
    // RDS storage encryption is AWS-managed in shared-infra — this key is app-layer only.
    this.kmsKey = new kms.Key(this, 'WobblioKmsKey', {
      description: 'Wobblio CMK — application-level AES-GCM envelope encryption',
      enableKeyRotation: true,
      alias: `alias/wobblio-cmk-${config.stage}`,
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, 'KmsKeyArn', {
      value: this.kmsKey.keyArn,
      exportName: `wobblio-${config.stage}-kms-key-arn`,
    });

    applyWobblioTags(this, config);
  }
}
