import * as path from 'path';
import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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

    const preSignUpHookFn = new NodejsFunction(this, 'PreSignUpHook', {
      entry: path.join(backendRoot, 'src/handlers/pre-signup-hook/index.ts'),
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
      environment: { STAGE: config.stage },
    });

    this.userPool = new cognito.UserPool(this, 'WobblioUserPool', {
      userPoolName: config.resourceName('user-pool'),
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      customAttributes: {
        role:              new cognito.StringAttribute({ mutable: true }),
        status:            new cognito.StringAttribute({ mutable: true }),
        waitlist_position: new cognito.NumberAttribute({ mutable: true }),
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
      lambdaTriggers: { preSignUp: preSignUpHookFn },
      removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Google OIDC federation
    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdp', {
      clientId: ssm.StringParameter.valueForStringParameter(
        this,
        '/wobblio/config/auth/google_client_id',
      ),
      clientSecretValue: secretsmanager.Secret.fromSecretNameV2(
        this,
        'GoogleClientSecret',
        'wobblio/auth/google',
      ).secretValueFromJson('client_secret'),
      userPool: this.userPool,
      scopes: ['email', 'profile', 'openid'],
      attributeMapping: {
        email:      cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName:  cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });

    // Meta (Facebook) OAuth 2.0 federation
    const metaIdp = new cognito.UserPoolIdentityProviderFacebook(this, 'MetaIdp', {
      clientId: ssm.StringParameter.valueForStringParameter(
        this,
        '/wobblio/config/auth/facebook_app_id',
      ),
      clientSecret: secretsmanager.Secret.fromSecretNameV2(
        this,
        'FacebookClientSecret',
        'wobblio/auth/facebook',
      ).secretValueFromJson('app_secret').unsafeUnwrap(),
      userPool: this.userPool,
      scopes: ['email', 'public_profile'],
      attributeMapping: {
        email:      cognito.ProviderAttribute.FACEBOOK_EMAIL,
        givenName:  cognito.ProviderAttribute.other('first_name'),
        familyName: cognito.ProviderAttribute.other('last_name'),
      },
    });

    // Hosted UI domain — allows social sign-in redirect
    this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix: `wobblio-${config.stage}` },
    });

    const callbackUrl =
      config.stage === 'prod'
        ? 'https://app.wobblio.nl/auth/callback'
        : `https://app.${config.stage}.wobblio.nl/auth/callback`;

    this.userPoolClientMobile = this.userPool.addClient('MobileClient', {
      userPoolClientName: config.resourceName('mobile-client'),
      generateSecret: false,
      authFlows: { userSrp: true },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.FACEBOOK,
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
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.FACEBOOK,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [callbackUrl],
        logoutUrls: [callbackUrl.replace('/callback', '/logout')],
      },
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // Suppress idP dependency ordering warning — CDK handles this implicitly
    this.userPoolClientMobile.node.addDependency(googleIdp, metaIdp);
    this.userPoolClientWeb.node.addDependency(googleIdp, metaIdp);

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

    NagSuppressions.addResourceSuppressions(preSignUpHookFn, [
      {
        id: 'AwsSolutions-L1',
        reason: 'Node 22 is current LTS; cdk-nag rule may flag it pending rule update',
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWSLambdaBasicExecutionRole is the minimal policy for Lambda CloudWatch Logs; acceptable for MVP',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
    ], true);

    applyWobblioTags(this, config);
  }
}
