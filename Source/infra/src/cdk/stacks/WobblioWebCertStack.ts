import { Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioWebCertStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class WobblioWebCertStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioWebCertStackProps) {
    // ACM certificates for CloudFront must be in us-east-1
    super(scope, id, {
      ...props,
      env: { region: 'us-east-1', account: props.config.account },
    });

    const { config } = props;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'wobblio.com',
    });

    const cert = new acm.Certificate(this, 'WebCertificate', {
      domainName: 'app.wobblio.com',
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // ARN written to us-east-1 SSM; read cross-region by WobblioWebStack via AwsCustomResource
    new ssm.StringParameter(this, 'WebCertArnParam', {
      parameterName: '/wobblio/web/certificate-arn',
      stringValue: cert.certificateArn,
      description: 'ACM certificate ARN for wobblio.com CloudFront distribution (us-east-1)',
    });

    applyWobblioTags(this, config);

    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-SSM4', reason: 'Certificate ARN is not a secret; SSM SecureString is not required' },
    ]);
  }
}
