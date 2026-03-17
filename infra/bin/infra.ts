#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/cognito-stack';
import { BackendStack } from '../lib/backend-stack';

const app = new cdk.App();

const env = {
  account: '867259842081',
  region: 'us-east-1',
};

const cognitoStack = new CognitoStack(app, 'HyraxFitnessCognito', {
  env,
  description: 'Hyrax Fitness - Cognito User Pool, Groups, and Lambda Triggers',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '1088784360564-ec6iseum863bqdn5dolfai63frs8nfbh.apps.googleusercontent.com',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
});

new BackendStack(app, 'HyraxFitnessBackend', {
  env,
  description: 'Hyrax Fitness - API Gateway, DynamoDB, S3, and Lambda API',
  userPoolId: cognitoStack.userPoolId,
  userPoolArn: cognitoStack.userPoolArn,
});
