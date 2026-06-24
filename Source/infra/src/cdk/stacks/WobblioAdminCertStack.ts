import { Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioAdminCertStackProps extends StackProps {
  config: EnvironmentConfig;
}

// Operator office / VPN egress ranges. Editable without a code change via CDK context
// (`-c adminWafAllowlist=1.2.3.0/24` / `-c adminWafAllowlistV6=2001:db8::/32`). Defaults
// are all-IPv4 + all-IPv6 so a fresh dev deploy is not bricked (CloudFront serves both
// families); narrow BOTH before any real admin.wobblio.com exposure.
// WAFv2 rejects the /0 default route, so "all addresses" is expressed as two /1
// halves (the documented workaround) for both families.
const DEFAULT_ALLOWLIST = ['0.0.0.0/1', '128.0.0.0/1'];
const DEFAULT_ALLOWLIST_V6 = ['::/1', '8000::/1'];

// us-east-1: both the CloudFront ACM certificate AND the CLOUDFRONT-scoped WAFv2 web
// ACL must live here. ARNs are published to us-east-1 SSM and read cross-region by
// WobblioAdminStack (admin-console 01).
export class WobblioAdminCertStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioAdminCertStackProps) {
    super(scope, id, { ...props, env: { region: 'us-east-1', account: props.config.account } });

    const { config } = props;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.zoneDomain,
    });

    const cert = new acm.Certificate(this, 'AdminCertificate', {
      domainName: config.adminDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new ssm.StringParameter(this, 'AdminCertArnParam', {
      parameterName: config.adminCertSsmPath,
      stringValue: cert.certificateArn,
      description: `ACM certificate ARN for ${config.adminDomain} CloudFront distribution (us-east-1)`,
    });

    // ── WAF: IP allowlist, default-block (defence-in-depth; the Cognito+ADMIN gate
    //    from sub-spec 00 is still the primary control). ──────────────────────────
    const ipSetV4 = new wafv2.CfnIPSet(this, 'AdminAllowlistIpSet', {
      name: config.resourceName('admin-allowlist'),
      scope: 'CLOUDFRONT',
      ipAddressVersion: 'IPV4',
      addresses: this.resolveAllowlist('adminWafAllowlist', DEFAULT_ALLOWLIST),
    });
    const ipSetV6 = new wafv2.CfnIPSet(this, 'AdminAllowlistIpSetV6', {
      name: config.resourceName('admin-allowlist-v6'),
      scope: 'CLOUDFRONT',
      ipAddressVersion: 'IPV6',
      addresses: this.resolveAllowlist('adminWafAllowlistV6', DEFAULT_ALLOWLIST_V6),
    });

    const allowRule = (name: string, priority: number, arn: string): wafv2.CfnWebACL.RuleProperty => ({
      name,
      priority,
      action: { allow: {} },
      statement: { ipSetReferenceStatement: { arn } },
      visibilityConfig: { cloudWatchMetricsEnabled: true, sampledRequestsEnabled: true, metricName: name },
    });

    const webAcl = new wafv2.CfnWebACL(this, 'AdminWebAcl', {
      name: config.resourceName('admin-waf'),
      scope: 'CLOUDFRONT',
      defaultAction: { block: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: config.resourceName('admin-waf'),
      },
      rules: [
        allowRule('allow-operator-ips-v4', 0, ipSetV4.attrArn),
        allowRule('allow-operator-ips-v6', 1, ipSetV6.attrArn),
      ],
    });

    new ssm.StringParameter(this, 'AdminWafAclArnParam', {
      parameterName: config.adminWafAclSsmPath,
      stringValue: webAcl.attrArn,
      description: `WAFv2 web-ACL ARN for ${config.adminDomain} CloudFront distribution (us-east-1)`,
    });

    applyWobblioTags(this, config);

    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-SSM4', reason: 'Certificate / WAF ARNs are not secrets; SSM SecureString is not required' },
    ]);
  }

  private resolveAllowlist(contextKey: string, fallback: string[]): string[] {
    const ctx = this.node.tryGetContext(contextKey) as string | undefined;
    if (!ctx) return fallback;
    return ctx
      .split(',')
      .map((cidr) => cidr.trim())
      .filter(Boolean);
  }
}
