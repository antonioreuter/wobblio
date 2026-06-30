#!/usr/bin/env node
import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { buildEnvironmentConfig } from '../src/cdk/config/environment';
import { WobblioLocalBootstrapStack } from '../src/cdk/stacks/WobblioLocalBootstrapStack';
import { WobblioConfigStack } from '../src/cdk/stacks/WobblioConfigStack';
import { WobblioDbStack } from '../src/cdk/stacks/WobblioDbStack';
import { WobblioAuthStack } from '../src/cdk/stacks/WobblioAuthStack';
import { WobblioStorageStack } from '../src/cdk/stacks/WobblioStorageStack';
import { WobblioObservabilityStack } from '../src/cdk/stacks/WobblioObservabilityStack';
import { WobblioBackendStack } from '../src/cdk/stacks/WobblioBackendStack';
import { WobblioDataAiPipelineStack } from '../src/cdk/stacks/WobblioDataAiPipelineStack';
import { WobblioWebCertStack } from '../src/cdk/stacks/WobblioWebCertStack';
import { WobblioWebStack } from '../src/cdk/stacks/WobblioWebStack';
import { WobblioAdminCertStack } from '../src/cdk/stacks/WobblioAdminCertStack';
import { WobblioAdminStack } from '../src/cdk/stacks/WobblioAdminStack';

const app = new App();
const config = buildEnvironmentConfig();

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

if (config.isLocal) {
  new WobblioLocalBootstrapStack(app, 'WobblioLocalBootstrapStack', {
    env: config.cdkEnv,
    config,
  });
} else {
  // ── Config (Parameter Store, seeded from config/config.<stage>.json) ─────────
  const configStack = new WobblioConfigStack(app, `WobblioConfigStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
  });

  // ── Foundation ──────────────────────────────────────────────────────────────
  const dbStack = new WobblioDbStack(app, `WobblioDbStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
  });
  // ConfigStack is the first stack to deploy: every other stack roots on the DB stack,
  // so making the DB stack wait on config puts config ahead of the whole graph (cdk
  // deploy --all). The backend's explicit dependency below stays for clarity.
  dbStack.addDependency(configStack);

  const authStack = new WobblioAuthStack(app, `WobblioAuthStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    dbStack,
  });
  authStack.addDependency(dbStack);

  // ── Storage ─────────────────────────────────────────────────────────────────
  const storageStack = new WobblioStorageStack(app, `WobblioStorageStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    dbStack,
  });
  storageStack.addDependency(dbStack);

  // ── Observability ────────────────────────────────────────────────────────────
  const obsStack = new WobblioObservabilityStack(app, `WobblioObservabilityStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    dbStack,
  });
  obsStack.addDependency(dbStack);

  // ── Backend ──────────────────────────────────────────────────────────────────
  const backendStack = new WobblioBackendStack(app, `WobblioBackendStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    dbStack,
    authStack,
    storageStack,
  });
  backendStack.addDependency(dbStack);
  backendStack.addDependency(authStack);
  backendStack.addDependency(storageStack);
  backendStack.addDependency(obsStack);
  // Config params must exist before the backend resolves them at deploy (waitlist cap env)
  // and reads them at runtime.
  backendStack.addDependency(configStack);

  // ── Data-AI pipeline (Non-Functional 01) ─────────────────────────────────────
  // Dedicated stack for the agentic ingestion compute + queue. Independent of the
  // backend stack; the queue receives no traffic until dynamic routing (04) flips the
  // feature flag, so it can be (re)deployed without touching the live legacy path.
  const dataAiStack = new WobblioDataAiPipelineStack(app, `WobblioDataAiPipelineStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    dbStack,
    storageStack,
  });
  dataAiStack.addDependency(dbStack);
  dataAiStack.addDependency(storageStack);
  // Writes into the stage-scoped config namespace seeded by ConfigStack.
  dataAiStack.addDependency(configStack);

  // ── Web ──────────────────────────────────────────────────────────────────────
  // WobblioWebCertStack deploys to us-east-1 (CloudFront ACM requirement)
  const webCertStack = new WobblioWebCertStack(app, `WobblioWebCertStack-${config.stage}`, {
    config,
  });

  // WobblioWebStack deploys to eu-west-1; depends on cert stack and backend stack (hosted zone + API GW)
  const webStack = new WobblioWebStack(app, `WobblioWebStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    authStack,
  });
  webStack.addDependency(webCertStack);
  webStack.addDependency(backendStack);
  webStack.addDependency(authStack);

  // ── Admin console (isolated hosting) ──────────────────────────────────────────
  // Cert + WAF in us-east-1; the SSR distribution in the app region reads both ARNs
  // cross-region (admin-console 01).
  const adminCertStack = new WobblioAdminCertStack(app, `WobblioAdminCertStack-${config.stage}`, {
    config,
  });

  const adminStack = new WobblioAdminStack(app, `WobblioAdminStack-${config.stage}`, {
    env: config.cdkEnv,
    config,
    authStack,
  });
  adminStack.addDependency(adminCertStack);
  adminStack.addDependency(backendStack);
  adminStack.addDependency(authStack);

  // Suppress unused variable warnings — stacks are side-effect constructs
  void obsStack;
  void webStack;
  void adminStack;
  void dataAiStack;
}

app.synth();
