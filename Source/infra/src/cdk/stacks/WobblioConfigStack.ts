import { Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
import { loadAppConfig, configParamName } from '../config/appConfig';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioConfigStackProps extends StackProps {
  config: EnvironmentConfig;
}

// Owns the runtime application config in Parameter Store, seeded from the committed
// config/config.<stage>.json. This is the only place /wobblio/config/<stage>/* is created —
// out-of-band CLI seeding is gone. Stage-scoped so dev and prod coexist in the shared account;
// the backend reads the same physical paths via stageConfig (CONFIG_STAGE=<stage>).
export class WobblioConfigStack extends Stack {
  constructor(scope: Construct, id: string, props: WobblioConfigStackProps) {
    super(scope, id, props);

    const { config } = props;
    const entries = loadAppConfig(config.stage);

    for (const [relativeKey, value] of Object.entries(entries)) {
      new ssm.StringParameter(this, logicalId(relativeKey), {
        parameterName: configParamName(config.stage, relativeKey),
        stringValue: value,
      });
    }

    applyWobblioTags(this, config);
  }
}

// CloudFormation logical id from a config key ("quotas/max_pdf_bytes" → "CfgQuotasMaxPdfBytes").
function logicalId(relativeKey: string): string {
  const pascal = relativeKey
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `Cfg${pascal}`;
}
