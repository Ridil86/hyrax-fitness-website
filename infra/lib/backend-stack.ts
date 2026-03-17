import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface BackendStackProps extends cdk.StackProps {
  userPoolId: string;
  userPoolArn: string;
}

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // ── DynamoDB Table (single-table design) ──
    const table = new dynamodb.Table(this, 'HyraxContentTable', {
      tableName: 'HyraxContent',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── S3 Media Bucket ──
    const mediaBucket = new s3.Bucket(this, 'HyraxMediaBucket', {
      bucketName: `hyrax-fitness-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── API Lambda (monolith with internal routing) ──
    const apiFn = new NodejsFunction(this, 'HyraxApiFn', {
      functionName: 'hyrax-api',
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'api', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: mediaBucket.bucketName,
        USER_POOL_ID: props.userPoolId,
      },
      bundling: {
        minify: true,
        sourceMap: false,
        forceDockerBundling: false,
      },
    });

    // Grant Lambda permissions
    table.grantReadWriteData(apiFn);
    mediaBucket.grantPut(apiFn);
    mediaBucket.grantRead(apiFn);

    // Cognito permissions for user management
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
        ],
        resources: [props.userPoolArn],
      })
    );

    // ── API Gateway ──
    const api = new apigateway.RestApi(this, 'HyraxApi', {
      restApiName: 'hyrax-fitness-api',
      description: 'Hyrax Fitness backend API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
        ],
      },
      deployOptions: {
        stageName: 'prod',
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'HyraxAuthorizer',
      {
        cognitoUserPools: [
          cdk.aws_cognito.UserPool.fromUserPoolArn(
            this,
            'ImportedUserPool',
            props.userPoolArn
          ),
        ],
        authorizerName: 'HyraxCognitoAuthorizer',
      }
    );

    const lambdaIntegration = new apigateway.LambdaIntegration(apiFn);

    // ── API Routes ──
    const apiResource = api.root.addResource('api');

    // FAQ routes
    const faqResource = apiResource.addResource('faq');
    faqResource.addMethod('GET', lambdaIntegration); // Public
    faqResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const faqReorder = faqResource.addResource('reorder');
    faqReorder.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const faqItem = faqResource.addResource('{id}');
    faqItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    faqItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Content routes
    const contentResource = apiResource.addResource('content');
    const contentSection = contentResource.addResource('{section}');
    contentSection.addMethod('GET', lambdaIntegration); // Public
    contentSection.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Users routes (all admin-only)
    const usersResource = apiResource.addResource('users');
    usersResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const userItem = usersResource.addResource('{username}');
    userItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const userGroups = userItem.addResource('groups');
    userGroups.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userGroups.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const userStatus = userItem.addResource('status');
    userStatus.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Upload route (admin-only)
    const uploadResource = apiResource.addResource('upload');
    uploadResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Signup route (public - intake wizard)
    const signupResource = apiResource.addResource('signup');
    signupResource.addMethod('POST', lambdaIntegration); // Public

    // Profile route (authenticated, any group)
    const profileResource = apiResource.addResource('profile');
    profileResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Audit routes (POST is public for consent logging, GET is admin-only)
    const auditResource = apiResource.addResource('audit');
    auditResource.addMethod('POST', lambdaIntegration); // Public
    auditResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const auditStats = auditResource.addResource('stats');
    auditStats.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ── Stack Outputs ──
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: mediaBucket.bucketName,
      description: 'S3 Media Bucket Name',
    });
  }
}
