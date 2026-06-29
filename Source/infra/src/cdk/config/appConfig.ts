import * as fs from 'fs';
import * as path from 'path';
import type { Stage } from './environment';

const CONFIG_ROOT = '/wobblio/config';

// Repo-root config/ dir (Source/infra/src/cdk/config → up 5 → repo root).
const CONFIG_DIR = path.resolve(__dirname, '../../../../../config');

// The committed config/config.<stage>.json is the single source of truth for the runtime
// SSM application config the backend reads (model IDs, quota caps, routing, tags, billing).
// WobblioConfigStack (dev/prod) and the local bootstrap both seed Parameter Store from it,
// so there is no out-of-band CLI seeding.
export function loadAppConfig(stage: Stage): Record<string, string> {
  const raw = fs.readFileSync(path.join(CONFIG_DIR, `config.${stage}.json`), 'utf-8');
  return JSON.parse(raw) as Record<string, string>;
}

// Physical Parameter Store name for a relative config key. dev/prod are stage-scoped
// (/wobblio/config/<stage>/<key>) so both can own their config in the shared account
// without colliding; local is flat (isolated LocalStack). This must stay in lock-step with
// the backend's stageConfig.stageScopeConfig (CONFIG_STAGE set for dev/prod, unset locally).
export function configParamName(stage: Stage, relativeKey: string): string {
  return stage === 'local'
    ? `${CONFIG_ROOT}/${relativeKey}`
    : `${CONFIG_ROOT}/${stage}/${relativeKey}`;
}
