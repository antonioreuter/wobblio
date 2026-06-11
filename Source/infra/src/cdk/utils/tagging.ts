import { Tags } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environment';

export function applyWobblioTags(scope: Construct, config: EnvironmentConfig): void {
  Tags.of(scope).add('Environment', config.stage);
  Tags.of(scope).add('Project', 'wobblio');
  Tags.of(scope).add('Owner', 'platform-team');
}
