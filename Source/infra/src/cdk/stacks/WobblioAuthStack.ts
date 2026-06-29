import * as path from 'path';
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput, SecretValue } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { configParamName } from '../config/appConfig';
import { WobblioDbStack } from './WobblioDbStack';
import { WOBBLIO_LOGIN_SETTINGS, WOBBLIO_LOGIN_ASSETS } from '../branding/web-login-branding';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioAuthStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
}

export class WobblioAuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClientMobile: cognito.UserPoolClient;
  readonly userPoolClientWeb: cognito.UserPoolClient;
  /** NextAuth session-signing key, consumed by the SSR webapp Lambda as AUTH_SECRET. */
  readonly authSecret: secretsmanager.Secret;
  /** Cognito Hosted-UI host (no scheme), e.g. wobblio-dev.auth.eu-west-1.amazoncognito.com. */
  readonly cognitoDomain: string;
  /** Generated web-client secret, consumed by the SSR webapp as COGNITO_CLIENT_SECRET. */
  readonly webClientSecret: SecretValue;

  constructor(scope: Construct, id: string, props: WobblioAuthStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Pre-signup Lambda — runs outside VPC (shared-infra DB SG allows off-VPC access).
    // Stub only at this stage; business logic added in Epic 04.
    const backendRoot = path.join(__dirname, '../../../../backend');

    const dbHost      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/endpoint');
    const dbPort      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/port');
    const dbSecretArn = ssm.StringParameter.valueForStringParameter(this, config.dbSecretParam);

    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', dbSecretArn);

    const cognitoHookEnv = {
      STAGE:        config.stage,
      // Stage-scopes the pre-signup hook's waitlist-cap SSM read to
      // /wobblio/config/<stage>/* (same as the backend Lambdas) so each stage reads its
      // own cap and not a shared flat param.
      CONFIG_STAGE: config.stage,
      DB_HOST:      dbHost,
      DB_PORT:      dbPort,
      DB_SECRET_ARN: dbSecretArn,
    };

    const makeCognitoHook = (id: string, handlerDir: string): NodejsFunction =>
      new NodejsFunction(this, id, {
        functionName: config.resourceName(handlerDir),
        entry: path.join(backendRoot, `src/handlers/${handlerDir}/index.ts`),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(5),
        reservedConcurrentExecutions: 2,
        projectRoot: backendRoot,
        depsLockFilePath: path.join(backendRoot, 'package-lock.json'),
        bundling: {
          tsconfig: path.join(backendRoot, 'tsconfig.json'),
          externalModules: ['@aws-sdk/*'],
          minify: true,
        },
        environment: cognitoHookEnv,
      });

    const preSignUpHookFn       = makeCognitoHook('PreSignUpHook',       'pre-signup-hook');
    const postConfirmationHookFn = makeCognitoHook('PostConfirmationHook', 'post-confirmation-hook');

    this.userPool = new cognito.UserPool(this, 'WobblioUserPool', {
      userPoolName: config.resourceName('user-pool'),
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email:      { required: true,  mutable: false },
        givenName:  { required: false, mutable: true },
        familyName: { required: false, mutable: true },
      },
      customAttributes: {
        role:              new cognito.StringAttribute({ mutable: true }),
        status:            new cognito.StringAttribute({ mutable: true }),
        waitlist_position: new cognito.NumberAttribute({ mutable: true }),
        full_name:         new cognito.StringAttribute({ mutable: true }),
        country:           new cognito.StringAttribute({ mutable: true }),
        language:          new cognito.StringAttribute({ mutable: true }),
        currency:          new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      advancedSecurityMode: cognito.AdvancedSecurityMode.AUDIT,
      lambdaTriggers: { preSignUp: preSignUpHookFn, postConfirmation: postConfirmationHookFn },
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Hosted UI domain — allows social sign-in redirect. Managed Login (v2)
    // enables the branding designer so the hosted sign-in page can be themed to
    // match the Wobblio webapp design (passwords stay on the Cognito origin).
    const domainPrefix = `wobblio-${config.stage}`;
    this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });
    // Full Hosted-UI host the SSR webapp uses for the OAuth token endpoint.
    this.cognitoDomain = `${domainPrefix}.auth.${this.region}.amazoncognito.com`;

    // NextAuth (Auth.js) session-signing key for the SSR webapp. Generated once
    // per stage and consumed as the AUTH_SECRET env var on the web Lambda.
    this.authSecret = new secretsmanager.Secret(this, 'WebAuthSecret', {
      secretName: `wobblio/${config.stage}/web-auth-secret`,
      description: `NextAuth AUTH_SECRET for Wobblio ${config.stage} SSR webapp`,
      generateSecretString: {
        passwordLength: 48,
        excludePunctuation: true,
      },
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    NagSuppressions.addResourceSuppressions(this.authSecret, [
      { id: 'AwsSolutions-SMG4', reason: 'NextAuth signing key rotation is a manual operator action at MVP; automatic rotation deferred to Epic 12 security controls' },
    ]);

    const appOrigin =
      config.stage === 'prod'
        ? 'https://app.wobblio.com'
        : `https://app.${config.stage}.wobblio.com`;
    // One per NextAuth provider id. `cognito` = login; `cognito-signup` deep-links
    // to the Hosted-UI /signup tab (separate provider → separate callback path).
    // Both must be allowlisted or Cognito rejects the redirect (redirect_mismatch).
    // The admin console (admin-console 00/01) shares this web client + the same
    // Cognito pool; its sign-in OAuth redirect comes back to the admin origin, so
    // that callback must be allowlisted too (only the `cognito` login provider —
    // the admin app has no sign-up flow).
    const adminOrigin = `https://${config.adminDomain}`;
    const callbackUrls = [
      `${appOrigin}/api/auth/callback/cognito`,
      `${appOrigin}/api/auth/callback/cognito-signup`,
      `${adminOrigin}/api/auth/callback/cognito`,
    ];
    // Post-logout destinations for the Cognito Hosted-UI /logout endpoint (used by
    // the federated sign-out so the IdP SSO cookie is cleared, not just the local
    // session). Each must exactly match the logout_uri the app sends.
    const logoutUrls = [
      `${appOrigin}/`,
      `${appOrigin}/login`,
      `${appOrigin}/api/auth/signout`,
      `${adminOrigin}/`,
      `${adminOrigin}/login`,
    ];

    this.userPoolClientMobile = this.userPool.addClient('MobileClient', {
      userPoolClientName: config.resourceName('mobile-client'),
      generateSecret: false,
      authFlows: { userSrp: true },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['wobblio://auth/callback'],
        logoutUrls: ['wobblio://auth/logout'],
      },
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    this.userPoolClientWeb = this.userPool.addClient('WebClient', {
      userPoolClientName: config.resourceName('web-client'),
      generateSecret: true,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls,
        logoutUrls,
      },
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // Force creation of the DescribeCognitoUserPoolClient lookup here (in this
    // stack) so the SSR webapp can read the generated client secret and the
    // cdk-nag suppression below resolves against an existing resource.
    this.webClientSecret = this.userPoolClientWeb.userPoolClientSecret;

    // Managed Login branding for the web client — Wobblio palette + logo themed
    // onto the hosted sign-in page (passwords stay on the Cognito origin).
    new cognito.CfnManagedLoginBranding(this, 'WebManagedLoginBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.userPoolClientWeb.userPoolClientId,
      useCognitoProvidedValues: false,
      returnMergedResources: true,
      settings: WOBBLIO_LOGIN_SETTINGS,
      assets: WOBBLIO_LOGIN_ASSETS,
    });

    NagSuppressions.addResourceSuppressions(this.userPool, [
      {
        id: 'AwsSolutions-COG2',
        reason: 'MFA is OPTIONAL at MVP; waitlisted users need unenrolled sign-in access',
      },
      {
        id: 'AwsSolutions-COG8',
        reason: 'Cognito Advanced Security (plus tier) is a paid add-on; AUDIT mode is set for MVP and can be upgraded to ENFORCED when billing justifies it',
      },
    ]);

    // ── IAM grants for Cognito hook Lambdas ──────────────────────────────────
    const hookSsmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter${configParamName(config.stage, 'quotas/max_free_waitlist_cap')}`,
      ],
    });

    [preSignUpHookFn, postConfirmationHookFn].forEach(fn => {
      dbSecret.grantRead(fn);
      fn.addToRolePolicy(hookSsmPolicy);
    });

    const hookNagSuppressions = [
      {
        id: 'AwsSolutions-L1',
        reason: 'Node 22 is current LTS; cdk-nag rule may flag it pending rule update',
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWSLambdaBasicExecutionRole is the minimal policy for Lambda CloudWatch Logs; acceptable for MVP',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'SSM path wildcard is scoped to /shared/db/* and the specific waitlist cap parameter',
        appliesTo: [
          `Resource::arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
        ],
      },
    ];

    NagSuppressions.addResourceSuppressions(preSignUpHookFn, hookNagSuppressions, true);
    NagSuppressions.addResourceSuppressions(postConfirmationHookFn, hookNagSuppressions, true);

    // Reading the generated web-client secret (for the SSR webapp) provisions a
    // CDK-managed AwsCustomResource singleton (DescribeCognitoUserPoolClient).
    // Its provider Lambda + role are CDK-owned, like certArnReader in the web stack.
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/${this.stackName}/AWS679f53fac002430cb0da5b7982bd2287`,
      [
        { id: 'AwsSolutions-L1', reason: 'AwsCustomResource provider Lambda runtime is CDK-managed' },
        { id: 'AwsSolutions-IAM4', reason: 'AwsCustomResource provider uses the CDK-managed execution role with AWSLambdaBasicExecutionRole' },
      ],
      true,
    );

    applyWobblioTags(this, config);

    // ── CI/CD outputs — consumed by Next.js build env vars ───────────────────
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: config.resourceName('user-pool-id'),
    });
    new CfnOutput(this, 'WebClientId', {
      value: this.userPoolClientWeb.userPoolClientId,
      exportName: config.resourceName('web-client-id'),
    });
    // Mobile (Flutter) build inputs — the device app resolves these per stage at
    // build time via --dart-define (COGNITO_CLIENT_ID / COGNITO_DOMAIN), mirroring
    // how the web client ID is consumed. The mobile client is public (no secret).
    new CfnOutput(this, 'MobileClientId', {
      value: this.userPoolClientMobile.userPoolClientId,
      exportName: config.resourceName('mobile-client-id'),
    });
    new CfnOutput(this, 'CognitoDomain', {
      value: this.cognitoDomain,
      exportName: config.resourceName('cognito-domain'),
    });
    new CfnOutput(this, 'UserPoolIssuer', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
      exportName: config.resourceName('user-pool-issuer'),
    });
  }
}
