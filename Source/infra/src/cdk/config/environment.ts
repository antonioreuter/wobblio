export type Stage = 'local' | 'dev' | 'prod';

export interface EnvironmentConfig {
  stage: Stage;
  isLocal: boolean;
  region: string;
  account: string;
  localstackEndpoint: string | undefined;
  /** Root hosted zone — always wobblio.com */
  zoneDomain: string;
  /** CloudFront / webapp domain: app.wobblio.com (prod) | app.dev.wobblio.com (dev) */
  appDomain: string;
  /** API Gateway custom domain: api.wobblio.com (prod) | api.dev.wobblio.com (dev) */
  apiDomain: string;
  /** SSM path where WobblioWebCertStack writes the ACM cert ARN (stage-scoped) */
  webCertSsmPath: string;
  resourceName(base: string): string;
  cdkEnv: { account: string; region: string };
}

const VALID_STAGES: Stage[] = ['local', 'dev', 'prod'];
const ZONE_DOMAIN = 'wobblio.com';

export function buildEnvironmentConfig(): EnvironmentConfig {
  const raw = process.env.STAGE ?? 'local';

  if (!VALID_STAGES.includes(raw as Stage)) {
    throw new Error(`Invalid STAGE '${raw}'. Must be one of: ${VALID_STAGES.join(', ')}`);
  }

  const stage = raw as Stage;
  const isLocal = stage === 'local';
  const region = process.env.AWS_REGION ?? 'eu-west-1';
  const account = isLocal
    ? '000000000000'
    : (process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? '');

  const localstackEndpoint = isLocal
    ? (process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566')
    : undefined;

  // prod: app.wobblio.com  |  dev: app.dev.wobblio.com
  const subdomainInfix = stage === 'prod' ? '' : `${stage}.`;
  const appDomain = `app.${subdomainInfix}${ZONE_DOMAIN}`;
  const apiDomain = `api.${subdomainInfix}${ZONE_DOMAIN}`;

  return {
    stage,
    isLocal,
    region,
    account,
    localstackEndpoint,
    zoneDomain: ZONE_DOMAIN,
    appDomain,
    apiDomain,
    webCertSsmPath: `/wobblio/web/${stage}/certificate-arn`,
    resourceName: (base: string) => `wobblio-${base}-${stage}`,
    cdkEnv: { account, region },
  };
}
