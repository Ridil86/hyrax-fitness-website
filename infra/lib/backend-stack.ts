import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
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

    // GSI for cross-user queries (subscriptions, payments)
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
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

    // ── CloudFront Distribution for media assets ──
    const mediaDistribution = new cloudfront.Distribution(this, 'HyraxMediaCdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      comment: 'Hyrax Fitness media CDN',
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
        CDN_DOMAIN: mediaDistribution.distributionDomainName,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
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

    // ── MediaConvert Video Transcoding Pipeline ──

    // IAM Role that MediaConvert assumes to access S3
    const mediaConvertRole = new iam.Role(this, 'MediaConvertRole', {
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
      description: 'Role for MediaConvert to read/write S3 media bucket',
    });
    mediaBucket.grantRead(mediaConvertRole);
    mediaBucket.grantPut(mediaConvertRole);

    // Transcoder Lambda — triggered by S3 uploads and EventBridge
    const transcoderFn = new NodejsFunction(this, 'HyraxTranscoderFn', {
      functionName: 'hyrax-transcoder',
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'transcoder', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: mediaBucket.bucketName,
        CDN_DOMAIN: mediaDistribution.distributionDomainName,
        MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
        MEDIACONVERT_ENDPOINT: process.env.MEDIACONVERT_ENDPOINT || 'https://mediaconvert.us-east-1.amazonaws.com',
      },
      bundling: {
        minify: true,
        sourceMap: false,
        forceDockerBundling: false,
      },
    });

    // Grant Transcoder Lambda permissions
    table.grantReadWriteData(transcoderFn);
    mediaBucket.grantRead(transcoderFn);
    transcoderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'mediaconvert:CreateJob',
          'mediaconvert:GetJob',
          'mediaconvert:DescribeEndpoints',
        ],
        resources: ['*'],
      })
    );
    // MediaConvert needs PassRole to assume the MediaConvert role
    transcoderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [mediaConvertRole.roleArn],
      })
    );

    // S3 Event Notification — trigger transcoding when video uploaded
    mediaBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(transcoderFn),
      { prefix: 'uploads/videos/' }
    );

    // EventBridge Rule — catch MediaConvert job completion/failure
    const transcodingCompleteRule = new events.Rule(this, 'TranscodingCompleteRule', {
      description: 'Trigger Transcoder Lambda when MediaConvert job completes or fails',
      eventPattern: {
        source: ['aws.mediaconvert'],
        detailType: ['MediaConvert Job State Change'],
        detail: {
          status: ['COMPLETE', 'ERROR'],
        },
      },
    });
    transcodingCompleteRule.addTarget(new targets.LambdaFunction(transcoderFn));

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

    // Use an imported function reference for the integration to prevent CDK
    // from creating per-method Lambda permissions (which exceed the 20KB
    // resource-based policy limit). A single broad permission is added below.
    const apiFnRef = lambda.Function.fromFunctionArn(
      this, 'HyraxApiFnRef', apiFn.functionArn
    );
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFnRef);

    // Single broad permission for API Gateway to invoke Lambda
    apiFn.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: api.arnForExecuteApi('*', '/*', '*'),
    });

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

    // Equipment routes
    const equipmentResource = apiResource.addResource('equipment');
    equipmentResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    equipmentResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const equipmentItem = equipmentResource.addResource('{id}');
    equipmentItem.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    equipmentItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    equipmentItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Exercise routes
    const exercisesResource = apiResource.addResource('exercises');
    exercisesResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    exercisesResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const exerciseItem = exercisesResource.addResource('{id}');
    exerciseItem.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    exerciseItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    exerciseItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Workout routes
    const workoutsResource = apiResource.addResource('workouts');
    workoutsResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    workoutsResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const workoutItem = workoutsResource.addResource('{id}');
    workoutItem.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    workoutItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    workoutItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Video routes
    const videosResource = apiResource.addResource('videos');
    videosResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    videosResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const videoItem = videosResource.addResource('{id}');
    videoItem.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    videoItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    videoItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Completion log routes (all authenticated)
    const logsResource = apiResource.addResource('logs');
    logsResource.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    logsResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const logsWorkout = logsResource.addResource('workout');
    logsWorkout.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const logsStats = logsResource.addResource('stats');
    logsStats.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const logsExerciseHistory = logsResource.addResource('exercise-history');
    logsExerciseHistory.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const logsCalendar = logsResource.addResource('calendar');
    logsCalendar.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const logItem = logsResource.addResource('{id}');
    logItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Community routes (all authenticated)
    const communityResource = apiResource.addResource('community');

    // /api/community/threads
    const communityThreads = communityResource.addResource('threads');
    communityThreads.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    communityThreads.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/threads/{id}
    const communityThreadItem = communityThreads.addResource('{id}');
    communityThreadItem.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    communityThreadItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    communityThreadItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/threads/{id}/replies
    const communityReplies = communityThreadItem.addResource('replies');
    communityReplies.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/replies/{id}
    const communityReplyItem = communityResource.addResource('replies').addResource('{id}');
    communityReplyItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    communityReplyItem.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/reactions
    const communityReactions = communityResource.addResource('reactions');
    communityReactions.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/reports
    const communityReports = communityResource.addResource('reports');
    communityReports.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/stats (admin)
    const communityStats = communityResource.addResource('stats');
    communityStats.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /api/community/admin/*
    const communityAdmin = communityResource.addResource('admin');

    const communityQueue = communityAdmin.addResource('queue');
    communityQueue.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const communityModerate = communityAdmin.addResource('moderate').addResource('{id}');
    communityModerate.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const communityAdminReports = communityAdmin.addResource('reports').addResource('{id}');
    communityAdminReports.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const communityPin = communityAdmin.addResource('pin').addResource('{id}');
    communityPin.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Support ticket routes (all authenticated)
    const supportResource = apiResource.addResource('support');

    const supportTickets = supportResource.addResource('tickets');
    supportTickets.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    supportTickets.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const supportTicketItem = supportTickets.addResource('{id}');
    supportTicketItem.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    supportTicketItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const supportMessages = supportTicketItem.addResource('messages');
    supportMessages.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const supportStats = supportResource.addResource('stats');
    supportStats.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const supportAdmin = supportResource.addResource('admin');
    const supportAssign = supportAdmin.addResource('assign').addResource('{id}');
    supportAssign.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Upload route (admin-only)
    const uploadResource = apiResource.addResource('upload');
    uploadResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // User upload route (any authenticated user, images only)
    const userUploadResource = apiResource.addResource('user-upload');
    userUploadResource.addMethod('POST', lambdaIntegration, {
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
    profileResource.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    profileResource.addMethod('PUT', lambdaIntegration, {
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

    // Tier routes (GET public, PUT admin)
    const tiersResource = apiResource.addResource('tiers');
    tiersResource.addMethod('GET', lambdaIntegration); // Public
    const tierItem = tiersResource.addResource('{id}');
    tierItem.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Stripe routes
    const stripeResource = apiResource.addResource('stripe');

    // Config (public)
    const stripeConfig = stripeResource.addResource('config');
    stripeConfig.addMethod('GET', lambdaIntegration); // Public

    // Webhook (public - NO authorizer for Stripe signature verification)
    const stripeWebhook = stripeResource.addResource('webhook');
    stripeWebhook.addMethod('POST', lambdaIntegration); // Public

    // Checkout session (authenticated)
    const stripeCheckout = stripeResource.addResource('create-checkout-session');
    stripeCheckout.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Customer portal (authenticated)
    const stripePortal = stripeResource.addResource('create-portal-session');
    stripePortal.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Subscription (authenticated)
    const stripeSubscription = stripeResource.addResource('subscription');
    stripeSubscription.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Cancel subscription (authenticated)
    const stripeCancel = stripeResource.addResource('cancel-subscription');
    stripeCancel.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Admin billing routes
    const adminResource = apiResource.addResource('admin');

    // Admin analytics routes
    const analyticsResource = adminResource.addResource('analytics');
    const analyticsOverview = analyticsResource.addResource('overview');
    analyticsOverview.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const analyticsTrends = analyticsResource.addResource('trends');
    analyticsTrends.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const billingResource = adminResource.addResource('billing');

    const billingStats = billingResource.addResource('stats');
    billingStats.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const billingSubscriptions = billingResource.addResource('subscriptions');
    billingSubscriptions.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const billingPayments = billingResource.addResource('payments');
    billingPayments.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const billingUserPayments = billingPayments.addResource('{userSub}');
    billingUserPayments.addMethod('GET', lambdaIntegration, {
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

    new cdk.CfnOutput(this, 'MediaCdnDomain', {
      value: mediaDistribution.distributionDomainName,
      description: 'CloudFront CDN Domain for media assets',
    });
  }
}
