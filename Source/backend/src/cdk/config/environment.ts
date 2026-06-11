export type Stage = 'local' | 'dev' | 'prod';

export interface EnvironmentConfig {
  stage: Stage;
  isLocal: boolean;
  region: string;
  account: string;
  localstackEndpoint: string | undefined;
  resourceName(base: string): string;
  cdkEnv: { account: string; region: string };
}

const VALID_STAGES: Stage[] = ['local', 'dev', 'prod'];

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

  return {
    stage,
    isLocal,
    region,
    account,
    localstackEndpoint,
    resourceName: (base: string) => `wobblio-${base}-${stage}`,
    cdkEnv: { account, region },
  };
}
