import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class CognitoStack extends cdk.Stack {
  public readonly userPoolId: string;
  public readonly userPoolArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Expose for cross-stack references
    this.userPoolId = userPool.userPoolId;
    this.userPoolArn = userPool.userPoolArn;

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

    // ── App Client (SPA - no secret) ──
    const appClient = userPool.addClient('HyraxWebAppClient', {
      userPoolClientName: 'hyrax-web-app',
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

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
  }
}
