import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioWebStackProps extends StackProps {
  config: EnvironmentConfig;
}

// All EU/EEA member states + UK — launch market is NL, expanding as warranted
const EU_GEO_ALLOWLIST: string[] = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT',
  'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

export class WobblioWebStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioWebStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ── S3 bucket for static webapp assets ───────────────────────────────────
    const webAssetsBucket = new s3.Bucket(this, 'WebAssetsBucket', {
      bucketName: `wobblio-${config.stage}-web-assets-${config.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: config.stage !== 'prod',
    });

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

    // ── CloudFront Function: clean-URL rewrite ────────────────────────────────
    const urlRewriteFn = new cloudfront.Function(this, 'UrlRewriteFunction', {
      functionName: `wobblio-${config.stage}-url-rewrite`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  if (uri === '/') {
    event.request.uri = '/index.html';
  } else if (!uri.includes('.')) {
    event.request.uri = uri + '.html';
  }
  return event.request;
}
      `.trim()),
    });

    // ── CloudFront distribution ───────────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webAssetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        functionAssociations: [
          {
            function: urlRewriteFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      domainNames: [config.appDomain],
      certificate,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      geoRestriction: cloudfront.GeoRestriction.allowlist(...EU_GEO_ALLOWLIST),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ── Route53 alias records ─────────────────────────────────────────────────
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.zoneDomain,
    });

    // recordName is the part before .wobblio.com: 'app' (prod) | 'app.dev' (dev)
    const appRecordName = config.appDomain.replace(`.${config.zoneDomain}`, '');
    new route53.ARecord(this, 'AppAliasRecord', {
      zone: hostedZone,
      recordName: appRecordName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      ),
    });

    // ── BucketDeployment: sync webapp out/ to S3 ─────────────────────────────
    // Guard: if out/ doesn't exist at synth time (clean checkout), use a placeholder
    // so cdk synth succeeds before the webapp is built.
    const webappOutDir = path.join(__dirname, '../../../../webapp/out');
    let deploySource: string;
    if (fs.existsSync(webappOutDir)) {
      deploySource = webappOutDir;
    } else {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wobblio-web-placeholder-'));
      fs.writeFileSync(path.join(tmpDir, 'placeholder.html'), '<html><body>Building…</body></html>');
      deploySource = tmpDir;
    }

    new s3deploy.BucketDeployment(this, 'WebDeployment', {
      sources: [s3deploy.Source.asset(deploySource)],
      destinationBucket: webAssetsBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new CfnOutput(this, 'WebUrl', { value: `https://${config.appDomain}` });
    new CfnOutput(this, 'CloudFrontDomainName', { value: distribution.distributionDomainName });

    applyWobblioTags(this, config);

    // ── cdk-nag suppressions ──────────────────────────────────────────────────
    NagSuppressions.addResourceSuppressions(webAssetsBucket, [
      { id: 'AwsSolutions-S1', reason: 'Web assets bucket — access logging deferred to Epic 15 observability' },
    ]);

    NagSuppressions.addResourceSuppressions(distribution, [
      { id: 'AwsSolutions-CFR1', reason: 'Geo-restriction is applied via EU allowlist; non-EU blocked' },
      { id: 'AwsSolutions-CFR2', reason: 'WAF integration deferred to Epic 12 security controls' },
      { id: 'AwsSolutions-CFR3', reason: 'CloudFront access logging deferred to Epic 15 observability' },
      { id: 'AwsSolutions-CFR4', reason: 'TLS 1.2+ is the CloudFront default; viewer policy set to REDIRECT_TO_HTTPS' },
    ]);

    // BucketDeployment provisions a custom resource Lambda (CDK-managed)
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-L1', reason: 'BucketDeployment and AwsCustomResource Lambda runtimes are CDK-managed' },
      { id: 'AwsSolutions-IAM4', reason: 'BucketDeployment and AwsCustomResource use CDK-managed execution roles' },
      { id: 'AwsSolutions-IAM5', reason: 'BucketDeployment requires wildcard S3 actions scoped to the web assets bucket; CDK-managed pattern' },
    ]);
  }
}
