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
import { WobblioDbStack } from './WobblioDbStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioAuthStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
}

export class WobblioAuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClientMobile: cognito.UserPoolClient;
  readonly userPoolClientWeb: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: WobblioAuthStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Pre-signup Lambda — runs outside VPC (shared-infra DB SG allows off-VPC access).
    // Stub only at this stage; business logic added in Epic 04.
    const backendRoot = path.join(__dirname, '../../../../backend');

    const dbHost      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/endpoint');
    const dbPort      = ssm.StringParameter.valueForStringParameter(this, '/shared/db/port');
    const dbSecretArn = ssm.StringParameter.valueForStringParameter(this, '/shared/db/wobblio/secret-arn');

    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', dbSecretArn);

    const cognitoHookEnv = {
      STAGE:        config.stage,
      DB_HOST:      dbHost,
      DB_PORT:      dbPort,
      DB_SECRET_ARN: dbSecretArn,
    };

    const makeCognitoHook = (id: string, handlerDir: string): NodejsFunction =>
      new NodejsFunction(this, id, {
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

    // Hosted UI domain — allows social sign-in redirect
    this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix: `wobblio-${config.stage}` },
    });

    const callbackUrl =
      config.stage === 'prod'
        ? 'https://app.wobblio.com/api/auth/callback/cognito'
        : `https://app.${config.stage}.wobblio.com/api/auth/callback/cognito`;

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
        callbackUrls: [callbackUrl],
        logoutUrls: [callbackUrl.replace('/api/auth/callback/cognito', '/api/auth/signout')],
      },
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
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
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wobblio/config/quotas/max_free_waitlist_cap`,
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
    new CfnOutput(this, 'UserPoolIssuer', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
      exportName: config.resourceName('user-pool-issuer'),
    });
  }
}
