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
});

new BackendStack(app, 'HyraxFitnessBackend', {
  env,
  description: 'Hyrax Fitness - API Gateway, DynamoDB, S3, and Lambda API',
  userPoolId: cognitoStack.userPoolId,
  userPoolArn: cognitoStack.userPoolArn,
});
