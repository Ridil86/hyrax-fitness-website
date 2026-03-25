import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface CognitoStackProps extends cdk.StackProps {
  googleClientId: string;
  googleClientSecret: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPoolId: string;
  public readonly userPoolArn: string;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    // ── Cognito User Pool ──
    const userPool = new cognito.UserPool(this, 'HyraxUserPool', {
      userPoolName: 'hyrax-fitness-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: cognito.UserPoolEmail.withSES({
        fromEmail: 'noreply@hyraxfitness.com',
        fromName: 'Hyrax Fitness',
        sesRegion: 'us-east-1',
      }),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Expose for cross-stack references
    this.userPoolId = userPool.userPoolId;
    this.userPoolArn = userPool.userPoolArn;

    // ── Cognito Hosted-UI Domain ──
    userPool.addDomain('HyraxCognitoDomain', {
      cognitoDomain: { domainPrefix: 'hyrax-fitness' },
    });

    // ── Google Identity Provider ──
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool,
      clientId: props.googleClientId,
      clientSecretValue: cdk.SecretValue.unsafePlainText(props.googleClientSecret),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });

    // ── Groups ──
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admin',
      description: 'Site administrators with full dashboard access',
      precedence: 0,
    });

    new cognito.CfnUserPoolGroup(this, 'ClientGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Client',
      description: 'Registered clients / members',
      precedence: 10,
    });

    // ── Pre Sign-up Lambda Trigger ──
    // Handles Google account linking and duplicate email prevention
    const preSignUpFn = new NodejsFunction(this, 'PreSignUpFn', {
      functionName: 'hyrax-pre-signup',
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'pre-signup', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: false,
        forceDockerBundling: false,
      },
    });

    preSignUpFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminLinkProviderForUser',
          'cognito-idp:AdminAddUserToGroup',
        ],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`,
        ],
      })
    );

    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      preSignUpFn
    );

    // ── Post-Confirmation Lambda Trigger ──
    // Auto-bundles TypeScript with esbuild via NodejsFunction
    // Note: No environment variables needed - the event provides userPoolId
    const postConfirmationFn = new NodejsFunction(this, 'PostConfirmationFn', {
      functionName: 'hyrax-post-confirmation',
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'post-confirmation', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: false,
        forceDockerBundling: false,
      },
    });

    // Grant the Lambda permission to add users to groups
    // Use a constructed ARN to avoid circular dependency
    // (UserPool -> Lambda trigger, Lambda policy -> UserPool ARN)
    postConfirmationFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup'],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`,
        ],
      })
    );

    // Attach trigger to User Pool
    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationFn
    );

    // ── Custom Message Lambda Trigger ──
    // Branded HTML emails for verification, invitation, and forgot-password
    const customMessageFn = new NodejsFunction(this, 'CustomMessageFn', {
      functionName: 'hyrax-custom-message',
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'custom-message', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: false,
        forceDockerBundling: false,
      },
    });

    userPool.addTrigger(
      cognito.UserPoolOperation.CUSTOM_MESSAGE,
      customMessageFn
    );

    // ── App Client (SPA - no secret, OAuth + SRP) ──
    const appClient = userPool.addClient('HyraxWebAppClient', {
      userPoolClientName: 'hyrax-web-app',
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'https://hyraxfitness.com/',
          'http://localhost:5173/',
        ],
        logoutUrls: [
          'https://hyraxfitness.com/',
          'http://localhost:5173/',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
    });
    appClient.node.addDependency(googleProvider);

    // ── Stack Outputs ──
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: appClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: 'hyrax-fitness.auth.us-east-1.amazoncognito.com',
      description: 'Cognito Hosted UI Domain',
    });
  }
}
