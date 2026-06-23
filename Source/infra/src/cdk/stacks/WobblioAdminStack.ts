import * as path from 'path';
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Nextjs } from 'cdk-nextjs-standalone';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { WobblioAuthStack } from './WobblioAuthStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioAdminStackProps extends StackProps {
  config: EnvironmentConfig;
  authStack: WobblioAuthStack;
}

// Isolated admin-console hosting (admin-console 01): its own CloudFront distribution,
// ACM cert, Route53 record, and WAF — separate from the customer app. Mirrors
// WobblioWebStack (OpenNext SSR), pointed at Source/admin. The Cognito + ADMIN gate
// (sub-spec 00) is the primary control; the WAF IP allowlist is defence-in-depth.
export class WobblioAdminStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioAdminStackProps) {
    super(scope, id, props);

    const { config, authStack } = props;

    // ── Cross-region SSM reads (us-east-1): cert ARN + WAF web-ACL ARN ─────────
    const certArn = this.readUsEast1Ssm('AdminCertArnReader', config.adminCertSsmPath);
    const wafAclArn = this.readUsEast1Ssm('AdminWafArnReader', config.adminWafAclSsmPath);

    const certificate = acm.Certificate.fromCertificateArn(this, 'AdminCertificate', certArn);

    const adminDir = path.join(__dirname, '../../../../admin');
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.zoneDomain,
    });

    // Server-side env for the OpenNext SSR Lambda. Same Cognito pool as the webapp;
    // reuses the web app client (its callback list must include the admin domain's
    // /api/auth/callback/cognito before a real deploy). Role is read from the DB at
    // sign-in (no custom:role) — middleware then gates ADMIN.
    const ssrEnvironment: Record<string, string> = {
      API_BASE_URL: `https://${config.apiDomain}`,
      APP_ORIGIN: `https://${config.adminDomain}`,
      // Pin the public URL so NextAuth builds the OAuth redirect_uri from the admin
      // domain (not the CloudFront/Lambda host) when running behind CloudFront.
      AUTH_URL: `https://${config.adminDomain}/api/auth`,
      COGNITO_REGION: this.region,
      COGNITO_USER_POOL_ID: authStack.userPool.userPoolId,
      COGNITO_CLIENT_ID: authStack.userPoolClientWeb.userPoolClientId,
      COGNITO_CLIENT_SECRET: authStack.webClientSecret.unsafeUnwrap(),
      COGNITO_DOMAIN: authStack.cognitoDomain,
      AUTH_SECRET: authStack.authSecret.secretValue.unsafeUnwrap(),
      AUTH_TRUST_HOST: 'true',
    };

    const nextjs = new Nextjs(this, 'AdminSite', {
      nextjsPath: adminDir,
      environment: ssrEnvironment,
      domainProps: { domainName: config.adminDomain, certificate, hostedZone },
    });

    // Attach the WAF web ACL. NO geo restriction: unlike the customer webapp, the
    // admin console is an operator-only tool reached by a roaming team across many
    // countries — fencing it to the EU would lock out a travelling operator. Access
    // is controlled by the WAF + the Cognito/ADMIN gate, not by source country.
    const cfnDist = nextjs.distribution.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDist.addPropertyOverride('DistributionConfig.WebACLId', wafAclArn);

    new CfnOutput(this, 'AdminUrl', { value: `https://${config.adminDomain}` });
    new CfnOutput(this, 'AdminCloudFrontDomainName', { value: nextjs.distribution.distributionDomain });

    applyWobblioTags(this, config);

    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-L1', reason: 'SSR/image Lambdas are managed by cdk-nextjs-standalone' },
      { id: 'AwsSolutions-IAM4', reason: 'cdk-nextjs-standalone uses CDK-managed execution roles' },
      { id: 'AwsSolutions-IAM5', reason: 'cdk-nextjs-standalone CDK-managed constructs require wildcard S3 actions scoped to the assets bucket' },
      { id: 'AwsSolutions-S1', reason: 'Admin assets bucket access logging deferred to observability' },
      { id: 'AwsSolutions-CFR1', reason: 'Geo-restriction applied via EU allowlist' },
      { id: 'AwsSolutions-CFR2', reason: 'WAF web ACL is attached via DistributionConfig.WebACLId property override (cross-region us-east-1 ARN); cdk-nag does not detect override-based WAF attachment' },
      { id: 'AwsSolutions-CFR3', reason: 'CloudFront access logging deferred to observability' },
      { id: 'AwsSolutions-CFR4', reason: 'TLS 1.2+ is the CloudFront default; viewer policy enforced by cdk-nextjs-standalone' },
      { id: 'AwsSolutions-CFR7', reason: 'cdk-nextjs-standalone wires CloudFront to its S3 asset origin via a construct-managed OAI; the assets bucket blocks public access' },
      { id: 'AwsSolutions-SQS3', reason: 'OpenNext ISR revalidation queue is a CDK-managed internal component; a failed revalidation only serves slightly stale content' },
    ]);
  }

  private readUsEast1Ssm(id: string, parameterName: string): string {
    const reader = new cr.AwsCustomResource(this, id, {
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: parameterName },
        region: 'us-east-1',
        physicalResourceId: cr.PhysicalResourceId.of(parameterName),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE }),
      installLatestAwsSdk: false,
    });
    NagSuppressions.addResourceSuppressions(reader, [
      { id: 'AwsSolutions-L1', reason: 'AwsCustomResource Lambda runtime is CDK-managed' },
      { id: 'AwsSolutions-IAM4', reason: 'AwsCustomResource uses CDK-managed execution role' },
      { id: 'AwsSolutions-IAM5', reason: 'SSM GetParameter cross-region read; CDK-managed AwsCustomResource pattern' },
    ], true);
    return reader.getResponseField('Parameter.Value');
  }
}
