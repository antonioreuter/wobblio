import * as path from 'path';
import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
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

// All EU/EEA member states + UK — launch market is NL, expanding as warranted
const EU_GEO_ALLOWLIST: string[] = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT',
  'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

interface WobblioWebStackProps extends StackProps {
  config: EnvironmentConfig;
  authStack: WobblioAuthStack;
}

export class WobblioWebStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioWebStackProps) {
    super(scope, id, props);

    const { config, authStack } = props;

    // ── Cross-region SSM read: certificate ARN from us-east-1 ────────────────
    const certArnReader = new cr.AwsCustomResource(this, 'WebCertArnReader', {
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: config.webCertSsmPath },
        region: 'us-east-1',
        physicalResourceId: cr.PhysicalResourceId.of(config.webCertSsmPath),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      installLatestAwsSdk: false,
    });

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'WebCertificate',
      certArnReader.getResponseField('Parameter.Value'),
    );

    // ── Next.js deployment via OpenNext (SSR Lambda + S3 + CloudFront) ────────
    const webappDir = path.join(__dirname, '../../../../webapp');

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.zoneDomain,
    });

    // ── Server-side auth env for the OpenNext SSR Lambda ──────────────────────
    // The SSR app (Auth.js + Cognito Hosted UI) reads these at runtime. Omitting
    // COGNITO_ENDPOINT keeps the app in hosted-UI mode (vs. the local credentials
    // provider). NEXT_PUBLIC_* are baked at build time; these are server-only.
    const ssrEnvironment: Record<string, string> = {
      // Server-only backend base URL for BFF route handlers. A runtime env var
      // (not NEXT_PUBLIC_*) so it isn't build-time inlined — the OpenNext build
      // otherwise picks up .env.local's localhost value over .env.production.
      API_BASE_URL:         `https://${config.apiDomain}`,
      // Server-only app origin for routes that must build absolute self-URLs
      // (federated logout redirect, onboarding self-heal). Same reason as
      // API_BASE_URL: NEXT_PUBLIC_SITE_URL is build-time inlined and the OpenNext
      // build bakes .env.local's localhost over .env.production.
      APP_ORIGIN:           `https://${config.appDomain}`,
      COGNITO_REGION:       this.region,
      COGNITO_USER_POOL_ID: authStack.userPool.userPoolId,
      COGNITO_CLIENT_ID:    authStack.userPoolClientWeb.userPoolClientId,
      COGNITO_CLIENT_SECRET: authStack.webClientSecret.unsafeUnwrap(),
      COGNITO_DOMAIN:       authStack.cognitoDomain,
      AUTH_SECRET:          authStack.authSecret.secretValue.unsafeUnwrap(),
      AUTH_TRUST_HOST:      'true',
    };

    const nextjs = new Nextjs(this, 'NextjsSite', {
      nextjsPath: webappDir,
      environment: ssrEnvironment,
      // domainProps wires up ACM cert, CloudFront aliases, and Route53 A+AAAA records
      domainProps: {
        domainName: config.appDomain,
        certificate,
        hostedZone,
      },
    });

    // ── Add EU geo-restriction to the CloudFront distribution ─────────────────
    // Access the inner CloudFront Distribution via nextjs.distribution.distribution
    const cfnDist = nextjs.distribution.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDist.addPropertyOverride('DistributionConfig.Restrictions', {
      GeoRestriction: {
        RestrictionType: 'whitelist',
        Locations: EU_GEO_ALLOWLIST,
      },
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new CfnOutput(this, 'WebUrl', { value: `https://${config.appDomain}` });
    new CfnOutput(this, 'CloudFrontDomainName', {
      value: nextjs.distribution.distributionDomain,
    });

    applyWobblioTags(this, config);

    // ── cdk-nag suppressions ──────────────────────────────────────────────────
    // cdk-nextjs-standalone provisions CDK-managed Lambdas for SSR, image optimisation,
    // revalidation, and a BucketDeployment custom resource — all use CDK-managed roles.
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-L1', reason: 'SSR and image-optimization Lambdas are managed by cdk-nextjs-standalone; runtime version is kept current by the construct' },
      { id: 'AwsSolutions-IAM4', reason: 'cdk-nextjs-standalone uses CDK-managed execution roles with AWSLambdaBasicExecutionRole for its internal Lambdas' },
      { id: 'AwsSolutions-IAM5', reason: 'cdk-nextjs-standalone CDK-managed constructs require wildcard S3 actions scoped to the assets bucket' },
      { id: 'AwsSolutions-S1', reason: 'Web assets bucket access logging deferred to Epic 15 observability' },
      { id: 'AwsSolutions-CFR1', reason: 'Geo-restriction applied via EU allowlist; non-EU blocked' },
      { id: 'AwsSolutions-CFR2', reason: 'WAF integration deferred to Epic 12 security controls' },
      { id: 'AwsSolutions-CFR3', reason: 'CloudFront access logging deferred to Epic 15 observability' },
      { id: 'AwsSolutions-CFR4', reason: 'TLS 1.2+ is the CloudFront default; viewer policy enforced by cdk-nextjs-standalone' },
      { id: 'AwsSolutions-CFR7', reason: 'cdk-nextjs-standalone wires CloudFront to its S3 asset origin via a construct-managed origin access identity; the assets bucket blocks all public access' },
      { id: 'AwsSolutions-SQS3', reason: 'OpenNext ISR revalidation queue is a CDK-managed internal component of cdk-nextjs-standalone; a failed revalidation only serves slightly stale content, so no DLQ is provisioned by the construct' },
    ]);

    NagSuppressions.addResourceSuppressions(certArnReader, [
      { id: 'AwsSolutions-L1', reason: 'AwsCustomResource Lambda runtime is CDK-managed' },
      { id: 'AwsSolutions-IAM4', reason: 'AwsCustomResource uses CDK-managed execution role' },
      { id: 'AwsSolutions-IAM5', reason: 'SSM GetParameter scoped to the cert ARN SSM path; CDK-managed pattern' },
    ], true);
  }
}
